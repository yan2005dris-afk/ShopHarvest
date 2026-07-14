import { Source } from './source.entity';

/**
 * Port that the application layer needs to persist and load Source aggregates.
 * Implemented in infrastructure/persistence/prisma-sources.repository.ts.
 */
export interface SourcesRepository {
  findAll(): Promise<Source[]>;
  findById(id: string): Promise<Source | null>;
  findByCode(code: string): Promise<Source | null>;
  save(source: Source): Promise<Source>;
  delete(id: string): Promise<void>;
}

export const SOURCES_REPOSITORY = Symbol('SourcesRepository');
