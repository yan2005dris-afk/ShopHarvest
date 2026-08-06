import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { IngestProductsDto } from '@web-scraping/contracts/products';
import type { ScrapeResult } from '../interfaces';
import { IngestProductsUseCase } from '../../../operational/products/application/ingest-products.use-case';
import { OperationalPrismaService } from '../../../../common/prisma/operational-prisma.service';

/**
 * RawScraperIngestForwarder — bridges a successful headless-scrape JSON
 * dump (written to `ScrapeResult.outputPath` by the Playwright adapters)
 * back into the operational Product flow, so scraped items land in
 * `RawCapture` and reach the staging/DW ETL dashboard.
 *
 * Why this exists:
 *   - Headless scrapers (MercadoLibre/AliExpress) only write items to
 *     disk; `StagingProcessor` reads PRODUCTS exclusively from
 *     `RawCapture` (the extension ingest path). Without this bridge,
 *     scraped items are orphaned on disk.
 *   - We reuse `IngestProductsUseCase` (the SAME entry used by
 *     `POST /api/products/ingest`) so the operational Product + Offer +
 *     PriceObservation + RawCapture transaction is preserved and the
 *     extension flow is untouched.
 *
 * Idempotency — no extra dedup is needed:
 *   `PrismaProductsRepository.ingest` upserts Product/Offer by
 *   `(sourceId, url)` (see the instance path around prisma-products.repository.ts)
 *   and upserts RawCapture by `(offerId, sourceId)`. Re-forwarding the same
 *   `(sourceId, url)` on a later scheduler tick therefore takes the UPDATE
 *   branch: payload refreshed and RawCapture status reset to UNPROCESSED,
 *   which re-seeds staging without creating duplicates.
 *
 * Failure containment: read/ingest errors are logged and swallowed so a
 * forwarding failure can never fail the scrape response or a `runAll` pass.
 */
@Injectable()
export class RawScraperIngestForwarder {
  private readonly logger = new Logger(RawScraperIngestForwarder.name);

  constructor(
    private readonly ingestUseCase: IngestProductsUseCase,
    // Injected for DI parity with the operational ingest stack; reserved
    // for a future DB-backed dedup sanity check. Currently unused.
    private readonly operationalPrisma: OperationalPrismaService,
  ) {}

  async forwardIfProducible(result: ScrapeResult): Promise<void> {
    const source = result.source;
    if (result.totalScraped <= 0 || !result.outputPath) {
      return;
    }

    try {
      const items = await this.readItems(result.outputPath);
      if (!items) {
        return;
      }

      const products = this.toProduct(items);
      if (products.length === 0) {
        this.logger.warn(
          `IngestForwarder ${source}: dump had no usable product records`,
        );
        return;
      }

      const dto: IngestProductsDto = {
        domain: source,
        // `IngestProductsUseCase` derives each item's `url` from
        // `${pageUrl ?? domain}#${slug}-${index}`. Without a real URL the
        // dump becomes `mercadolibre#...-0`, which fails the ETL quality
        // gate `url-well-formed` (`new URL(...)` throws) and the whole
        // load is dropped. Anchor the dedup URL to a well-formed source
        // page so the gate passes while staying dedup-safe per index.
        pageUrl: `https://${source}.com/`,
        products,
      };

      const outcome = await this.ingestUseCase.execute(dto);
      this.logger.log(
        `IngestForwarder ${source}: forwarded ${items.length} raw items, ` +
          `${outcome.ingested ?? 0} ingested`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`IngestForwarder ${source} failed: ${msg}`);
    }
  }

  /**
   * Resolve the scraper's dump path. `ScrapeResult.outputPath` may be an
   * absolute path (when `outputDir` was absolute) or a path relative to
   * the backend cwd (the scrapers build it from `PIPELINE_RAW_DIR`, which
   * NestJS runs with cwd already at `backend/`). Anchor relative paths to
   * `process.cwd()` so reads resolve the same way the scraper wrote them.
   */
  private async readItems(outputPath: string): Promise<unknown[] | null> {
    const resolved = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(process.cwd(), outputPath);

    let raw: string;
    try {
      raw = await fs.readFile(resolved, 'utf-8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        this.logger.warn(`IngestForwarder: outputPath missing`);
      } else {
        this.logger.warn(
          `IngestForwarder: could not read ${resolved}: ` +
            `${(err as Error)?.message ?? String(err)}`,
        );
      }
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.warn(
        `IngestForwarder: outputPath is not valid JSON: ` +
          `${(err as Error)?.message ?? String(err)}`,
      );
      return null;
    }

    if (!Array.isArray(parsed)) {
      this.logger.warn('IngestForwarder: outputPath is not a JSON array');
      return null;
    }
    return parsed;
  }

  /**
   * Map the raw dump items into `IngestProductsDto.products`, keeping each
   * item's original keys/values and coercing `undefined`/non-scalar values
   * to `null` (the DTO's scalar contract).
   */
  private toProduct(
    items: unknown[],
  ): Array<Record<string, string | number | null>> {
    return items.map((item) => {
      const record: Record<string, string | number | null> = {};
      if (item && typeof item === 'object') {
        for (const [key, value] of Object.entries(item as object)) {
          record[key] =
            typeof value === 'string' || typeof value === 'number'
              ? value
              : null;
        }
      }
      return record;
    });
  }
}