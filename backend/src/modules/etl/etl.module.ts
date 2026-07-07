import { Module } from '@nestjs/common';
import { EtlController } from './etl.controller';
import { EtlService } from './etl.service';

/**
 * EtlModule — read-only API surface for ETL run history.
 *
 * PrismaModule is @Global() in `backend/src/common/prisma/prisma.module.ts:4`,
 * so we don't import it explicitly — PrismaService is available everywhere.
 */
@Module({
  controllers: [EtlController],
  providers: [EtlService],
  exports: [EtlService],
})
export class EtlModule {}
