import { Inject, Injectable } from '@nestjs/common';
import { SourceNotFoundError } from '../domain/source.errors';
import { SOURCES_REPOSITORY } from '../domain/sources.repository';
import type { SourcesRepository } from '../domain/sources.repository';

/** Deletes a source by id, throwing SourceNotFoundError if it doesn't exist. */
@Injectable()
export class DeleteSourceUseCase {
  constructor(
    @Inject(SOURCES_REPOSITORY)
    private readonly repository: SourcesRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const source = await this.repository.findById(id);
    if (!source) {
      throw new SourceNotFoundError(id);
    }
    await this.repository.delete(id);
  }
}
