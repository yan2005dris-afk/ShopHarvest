import { Module } from '@nestjs/common';
import { CreateSourceUseCase } from './application/create-source.use-case';
import { DeleteSourceUseCase } from './application/delete-source.use-case';
import { FindSourceUseCase } from './application/find-source.use-case';
import { ListSourcesUseCase } from './application/list-sources.use-case';
import { UpdateSourceUseCase } from './application/update-source.use-case';
import { SOURCES_REPOSITORY } from './domain/sources.repository';
import { SourcesHttpController } from './infrastructure/http/sources-http.controller';
import { PrismaSourcesRepository } from './infrastructure/persistence/prisma-sources.repository';

@Module({
  controllers: [SourcesHttpController],
  providers: [
    PrismaSourcesRepository,
    { provide: SOURCES_REPOSITORY, useExisting: PrismaSourcesRepository },
    CreateSourceUseCase,
    FindSourceUseCase,
    ListSourcesUseCase,
    UpdateSourceUseCase,
    DeleteSourceUseCase,
  ],
  exports: [
    SOURCES_REPOSITORY,
    CreateSourceUseCase,
    FindSourceUseCase,
    ListSourcesUseCase,
    UpdateSourceUseCase,
    DeleteSourceUseCase,
  ],
})
export class SourcesModule {}
