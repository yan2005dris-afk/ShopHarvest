import { Brand } from './brand.entity';

/**
 * Framework-agnostic result of a fuzzy-match query.
 * Use cases ONLY see this type — the SQL lives in the infrastructure layer.
 */
export interface FuzzyMatchCandidate {
  brand: Brand;
  similarity: number;
  lowConfidence: boolean;
}

/**
 * Input for fuzzy matching: the user query and the minimum similarity threshold.
 */
export interface FuzzyMatchQuery {
  query: string;
  threshold?: number;
}

/**
 * Port that the application layer needs to persist and load Brand aggregates
 * and to execute fuzzy-match lookups.
 * Implemented in infrastructure/persistence/prisma-brands.repository.ts.
 */
export interface BrandsRepository {
  findAll(): Promise<Brand[]>;
  findById(id: string): Promise<Brand | null>;
  findByName(name: string): Promise<Brand | null>;
  save(brand: Brand): Promise<Brand>;
  delete(id: string): Promise<void>;
  fuzzyMatch(input: FuzzyMatchQuery): Promise<FuzzyMatchCandidate[]>;
}

export const BRANDS_REPOSITORY = Symbol('BrandsRepository');
