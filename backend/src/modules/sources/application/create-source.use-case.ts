import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Source } from '../domain/source.entity';
import { DuplicateSourceCodeError } from '../domain/source.errors';
import { SOURCES_REPOSITORY } from '../domain/sources.repository';
import type { SourcesRepository } from '../domain/sources.repository';

export interface CreateSourceCommand {
  code: string;
  name: string;
  baseUrl: string;
  config?: Record<string, unknown> | null;
}

/** Creates a new scraping source after enforcing code uniqueness. */
@Injectable()
export class CreateSourceUseCase {
  constructor(
    @Inject(SOURCES_REPOSITORY)
    private readonly repository: SourcesRepository,
  ) {}

  async execute(command: CreateSourceCommand): Promise<Source> {
    const existing = await this.repository.findByCode(command.code);
    if (existing) {
      throw new DuplicateSourceCodeError(command.code);
    }
    const source = Source.create({
      id: randomUUID(),
      code: command.code,
      name: command.name,
      baseUrl: command.baseUrl,
      config: command.config ?? null,
    });
    return this.repository.save(source);
  }
}
