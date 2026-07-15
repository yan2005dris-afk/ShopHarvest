import { Inject, Injectable, Logger } from '@nestjs/common';
import { DW_LOADER } from '@web-scraping/contracts/pipeline';
import type { IDwLoader, LoadResult } from '../../etl/pipeline/interfaces';

/**
 * DwLoaderService — analytics-side thin wrapper around `IDwLoader`.
 *
 * Previously this service held the full ETL logic inline (replicated
 * verbatim from `backend/pipeline/scripts/dw/dw_load_staging.ts`).
 * After the Ports & Adapters refactor the canonical implementation
 * lives in `DwLoaderAdapter` (registered as `DW_LOADER`), and this
 * service just delegates. The single-line shim exists for two
 * reasons:
 *
 *   1. `AnalyticsController.load()` (kept unchanged by the refactor
 *      scope) calls `this.dwLoader.run({ truncate_first })` and
 *      expects a snake_case response envelope. `LoadResult` (the
 *      contracts interface) uses camelCase, so this method maps the
 *      canonical shape back to the controller's contract.
 *   2. Future extensions (e.g. cross-cutting logging or metrics)
 *      can hang off this facade without touching the adapter.
 */
@Injectable()
export class DwLoaderService {
  private readonly logger = new Logger(DwLoaderService.name);

  constructor(@Inject(DW_LOADER) private readonly dwLoader: IDwLoader) {}

  /**
   * Run the staging → DW ETL pipeline.
   *
   * Returns the snake_case envelope that `AnalyticsController.load`
   * already wires into the `/api/analytics/load` response — preserves
   * the HTTP contract so existing frontend callers keep working.
   */
  async run(opts: { truncate_first?: boolean } = {}): Promise<
    | {
        productos_cargados: number;
        encuestas_cargadas: number;
        tiempo_ms: number;
        estado: 'completado';
      }
    | { error: string; estado: 'fallido' }
  > {
    const result: LoadResult = await this.dwLoader.load({
      truncateFirst: opts.truncate_first ?? false,
    });

    if (result.estado === 'completado') {
      return {
        productos_cargados: result.productosCargados,
        encuestas_cargadas: result.encuestasCargadas,
        tiempo_ms: result.tiempoMs,
        estado: 'completado',
      };
    }

    this.logger.error(`DW load failed: ${result.error ?? '(unknown error)'}`);
    return {
      error: result.error ?? 'Carga del DW fallida sin mensaje específico',
      estado: 'fallido',
    };
  }
}
