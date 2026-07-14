import { Inject, Injectable } from '@nestjs/common';
import { Source } from '../domain/source.entity';
import { SourceNotFoundError } from '../domain/source.errors';
import { SOURCES_REPOSITORY } from '../domain/sources.repository';
import type { SourcesRepository } from '../domain/sources.repository';

/** Returns the source with the given id, or throws SourceNotFoundError. */
@Injectable()
export class FindSourceUseCase {
  constructor(
    @Inject(SOURCES_REPOSITORY)
    private readonly repository: SourcesRepository,
  ) {}

  async execute(id: string): Promise<Source> {
    const source = await this.repository.findById(id);
    if (!source) {
      throw new SourceNotFoundError(id);
    }
    return source;
  }
}
