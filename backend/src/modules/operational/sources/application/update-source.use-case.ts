import { Inject, Injectable } from '@nestjs/common';
import { Source, SourceStatus } from '../domain/source.entity';
import { SourceNotFoundError } from '../domain/source.errors';
import { SOURCES_REPOSITORY } from '../domain/sources.repository';
import type { SourcesRepository } from '../domain/sources.repository';

export interface UpdateSourceCommand {
  id: string;
  name?: string;
  baseUrl?: string;
  status?: SourceStatus;
  config?: Record<string, unknown> | null;
}

/**
 * Loads a source, applies field changes + status-transition rules on the
 * aggregate, and persists the result.
 */
@Injectable()
export class UpdateSourceUseCase {
  constructor(
    @Inject(SOURCES_REPOSITORY)
    private readonly repository: SourcesRepository,
  ) {}

  async execute(command: UpdateSourceCommand): Promise<Source> {
    const source = await this.repository.findById(command.id);
    if (!source) {
      throw new SourceNotFoundError(command.id);
    }
    source.update({
      name: command.name,
      baseUrl: command.baseUrl,
      status: command.status,
      config: command.config,
    });
    return this.repository.save(source);
  }
}
