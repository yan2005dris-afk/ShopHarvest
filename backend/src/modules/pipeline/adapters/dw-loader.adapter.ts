import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { IDwLoader, LoadResult } from '../interfaces';
import { runEtlScript } from '../pipeline-scripts-bridge';

/**
 * DwLoaderAdapter — implements `IDwLoader` by delegating to the
 * canonical runEtl() function in `backend/pipeline/scripts/dw/`.
 *
 * The legacy `dw-loader.service.ts` (still in AnalyticsModule for
 * backward compatibility with `POST /api/analytics/load`) now uses
 * this adapter internally. NestJS dependency injection wires the
 * concrete adapter under both the `DwLoaderAdapter` class token and
 * the `DW_LOADER` injection symbol so consumers can pick the form
 * that suits them.
 */
@Injectable()
export class DwLoaderAdapter implements IDwLoader {
  private readonly logger = new Logger(DwLoaderAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async load(opts?: { truncateFirst?: boolean }): Promise<LoadResult> {
    this.logger.log(
      `Iniciando carga DW via runEtl${opts?.truncateFirst ? ' (truncateFirst=true)' : ''}...`,
    );
    return runEtlScript(this.prisma as unknown as import('@prisma/client').PrismaClient, {
      truncateFirst: opts?.truncateFirst,
    });
  }
}
