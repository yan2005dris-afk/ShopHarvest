import { Module } from '@nestjs/common';
import { DeleteRawCaptureUseCase } from './application/delete-raw-capture.use-case';
import { FindRawCaptureUseCase } from './application/find-raw-capture.use-case';
import { ListRawCapturesUseCase } from './application/list-raw-captures.use-case';
import { UpsertRawCaptureUseCase } from './application/upsert-raw-capture.use-case';
import { RAW_CAPTURES_REPOSITORY } from './domain/raw-captures.repository';
import { RawCapturesHttpController } from './infrastructure/http/raw-captures-http.controller';
import { PrismaRawCapturesRepository } from './infrastructure/persistence/prisma-raw-captures.repository';

@Module({
  controllers: [RawCapturesHttpController],
  providers: [
    PrismaRawCapturesRepository,
    {
      provide: RAW_CAPTURES_REPOSITORY,
      useExisting: PrismaRawCapturesRepository,
    },
    UpsertRawCaptureUseCase,
    FindRawCaptureUseCase,
    ListRawCapturesUseCase,
    DeleteRawCaptureUseCase,
  ],
  exports: [
    RAW_CAPTURES_REPOSITORY,
    UpsertRawCaptureUseCase,
    FindRawCaptureUseCase,
    ListRawCapturesUseCase,
    DeleteRawCaptureUseCase,
  ],
})
export class RawCapturesModule {}
