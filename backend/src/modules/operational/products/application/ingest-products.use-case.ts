import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FieldMappingDto } from '@web-scraping/contracts/domains';
import type { IngestProductsDto } from '@web-scraping/contracts/products';
import {
  PRODUCTS_REPOSITORY,
  type IngestCommand,
  type IngestItem,
  type IngestResult,
  type ProductsRepository,
} from '../domain/products.repository';

/**
 * Per-item mapping output for one inbound product record. The use case
 * derives these from raw + field mappings BEFORE handing the batch to
 * the repository, so persistence never re-parses user input.
 */
interface DerivedItem {
  title: string;
  price: number;
  imageUrl?: string;
  sku?: string;
  description?: string;
}

/**
 * Maps the inbound payload (domain + products + optional mappings) into
 * the canonical Product + Offer + PriceObservation + RawCapture shape.
 *
 * Pipeline (preserved bit-for-bit from the legacy service):
 *
 *   1. Caller-supplied `fieldMappings` win when present. When missing
 *      (deprecated path), the use case derives a minimal mapping from
 *      the keys of the first product and warns once.
 *   2. Per item: pick the canonical title/price/sku/etc. via the
 *      effective mappings, slugify the title, and disambiguate the URL
 *      with the batch index so two items with identical titles do not
 *      collide on `(sourceId, url)`.
 *   3. Hand the derived batch to the repository, which owns the
 *      transaction (Source upsert → DomainRule upsert/backfill → per
 *      item: Product+Offer upsert, PriceObservation create, RawCapture
 *      upsert).
 *
 * No business logic beyond what the legacy service did. We just pushed
 * pure logic out of the transactional persistence layer so it is unit
 * testable without a DB.
 */
@Injectable()
export class IngestProductsUseCase {
  private readonly logger = new Logger(IngestProductsUseCase.name);

  constructor(
    @Inject(PRODUCTS_REPOSITORY)
    private readonly repository: ProductsRepository,
  ) {}

  async execute(dto: IngestProductsDto): Promise<IngestResult> {
    const effectiveMappings =
      dto.fieldMappings && dto.fieldMappings.length > 0
        ? dto.fieldMappings
        : this.deriveFieldMappingsFromPayload(dto.products);

    if (
      !(dto.fieldMappings && dto.fieldMappings.length > 0) &&
      dto.products.length > 0
    ) {
      this.logger.warn(
        `Ingest for "${dto.domain}" sent no fieldMappings; auto-derived from payload keys`,
      );
    }

    this.warnIfNoTitleMapping(dto.domain, effectiveMappings);

    const items: IngestItem[] = dto.products.map(
      (product: Record<string, string | number | null>, index: number) => {
        const derived = this.mapProductByRule(product, effectiveMappings);
        const titleSlug = derived.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 80);
        // Disambiguate duplicates: `url` is the dedup key against
        // (sourceId, url) on Offer, so two items with identical titles
        // would otherwise collide and the second silently overwrites the
        // first. Append the batch index as a stable suffix.
        const url = `${dto.pageUrl ?? dto.domain}#${titleSlug}-${index}`;

        return {
          url,
          title: derived.title,
          price: derived.price,
          currency: 'USD',
          sku: derived.sku,
          imageUrl: derived.imageUrl,
          description: derived.description,
          raw: product,
        };
      },
    );

    return this.repository.ingest({
      domain: dto.domain,
      pageUrl: dto.pageUrl,
      categoryId: dto.categoryId ?? null,
      fieldMappings: effectiveMappings,
      items,
    });
  }

  /**
   * Hoist the "no title mapping" warning so a 500-product ingest does
   * not log 500 lines.
   */
  private warnIfNoTitleMapping(
    domain: string,
    mappings: FieldMappingDto[],
  ): void {
    const hasTitleMapping = mappings.some((m) =>
      /^title$|^nombre$|^name$|^titulo$/i.test(m.canonicalField),
    );
    if (!hasTitleMapping) {
      this.logger.warn(
        `Ingest for "${domain}" has no canonical title mapping (title/nombre/name); products will fall back to "Raw product"`,
      );
    }
  }

  /**
   * Map an inbound product to normalized fields using the rule's
   * `fieldMappings`. The extension is the source of truth for which
   * canonical field a key represents; this function only translates.
   *
   * No guessing, no scanning. If a mapping is missing for a given role,
   * the corresponding field is `undefined` (except title/price which
   * have safe fallbacks).
   */
  private mapProductByRule(
    product: Record<string, unknown>,
    mappings: FieldMappingDto[],
  ): DerivedItem {
    const valueFor = (canonicalRegex: RegExp): unknown => {
      const mapping = mappings.find((m) =>
        canonicalRegex.test(m.canonicalField),
      );
      if (!mapping) return undefined;
      return product[mapping.canonicalField];
    };

    let title = 'Raw product';
    const titleMapping = mappings.find((m) =>
      /^title$|^nombre$|^name$|^titulo$/i.test(m.canonicalField),
    );
    if (titleMapping) {
      const raw = product[titleMapping.canonicalField];
      const trimmed = typeof raw === 'string' ? raw.trim() : '';
      if (trimmed) title = trimmed;
    }

    let price = 0;
    const priceMapping = mappings.find((m) =>
      /^price$|^precio$|^amount$/i.test(m.canonicalField),
    );
    if (priceMapping) {
      const raw = product[priceMapping.canonicalField];
      if (typeof raw === 'number' && raw >= 0) {
        price = raw;
      } else if (typeof raw === 'string') {
        const parsed = parseFloat(raw.trim());
        if (!Number.isNaN(parsed) && parsed >= 0) price = parsed;
      }
    }

    const asString = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined;

    return {
      title,
      price,
      imageUrl: asString(valueFor(/^image$|^img$|^foto$|^picture$|^imagen$/i)),
      sku: asString(valueFor(/^sku$/i)),
      description: asString(valueFor(/^desc/i)),
    };
  }

  /**
   * Build a minimal `FieldMapping[]` from the keys of the first product.
   * Used only as a fallback when the extension sends a payload without
   * `fieldMappings` (deprecated path). Selectors are empty; the next
   * mapping session in the extension UI should overwrite them.
   */
  private deriveFieldMappingsFromPayload(
    products: Array<Record<string, unknown>>,
  ): FieldMappingDto[] {
    if (products.length === 0) return [];
    const keys = Object.keys(products[0]);
    return keys.map((key) => ({
      canonicalField: key,
      selector: '',
      type: 'text' as const,
    }));
  }
}
