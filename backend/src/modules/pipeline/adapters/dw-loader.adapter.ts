import { Injectable, Logger } from '@nestjs/common';
import type { IDwLoader, LoadResult } from '../interfaces';

/**
 * DwLoaderAdapter — placeholder until PR 6 wires the native
 * `DwLoaderService` via the `DW_LOADER` DI token. The service
 * upserts staging rows into `dw.dim_fuente` + `dw.hecho_producto`
 * via Prisma and returns `LoadResult.estado ∈ {completado, fallido}`.
 *
 * For PR 1b the adapter keeps its `IDwLoader` contract and throws
 * "see PR 6" — the build stays green, DI bindings resolve, and
 * callers see the documented error instead of a runtime crash.
 */
@Injectable()
export class DwLoaderAdapter implements IDwLoader {
  private readonly logger = new Logger(DwLoaderAdapter.name);

  // eslint-disable-next-line @typescript-eslint/require-await
  async load(opts?: { truncateFirst?: boolean }): Promise<LoadResult> {
    void opts;
    this.logger.warn(
      'DwLoaderAdapter: native DwLoaderService not wired yet; see PR 6 (etl-staging-dw-native)',
    );
    throw new Error(
      'dw-loader: not implemented yet; see PR 6 (etl-staging-dw-native)',
    );
  }
}
