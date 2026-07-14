import { Inject, Injectable } from '@nestjs/common';
import { Source } from '../domain/source.entity';
import { SOURCES_REPOSITORY } from '../domain/sources.repository';
import type { SourcesRepository } from '../domain/sources.repository';

/** Returns every persisted source ordered as the repository decides. */
@Injectable()
export class ListSourcesUseCase {
  constructor(
    @Inject(SOURCES_REPOSITORY)
    private readonly repository: SourcesRepository,
  ) {}

  async execute(): Promise<Source[]> {
    return this.repository.findAll();
  }
}
