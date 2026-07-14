import { Inject, Injectable } from '@nestjs/common';
import { BRANDS_REPOSITORY } from '../domain/brands.repository';
import type {
  BrandsRepository,
  FuzzyMatchCandidate,
  FuzzyMatchQuery,
} from '../domain/brands.repository';

/**
 * Returns the list of candidate brands whose name is similar to the query
 * above the given threshold. Implementation lives in the repository
 * (currently pg_trgm similarity). The use case stays framework-agnostic.
 */
@Injectable()
export class FuzzyMatchBrandsUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY)
    private readonly repository: BrandsRepository,
  ) {}

  async execute(query: FuzzyMatchQuery): Promise<FuzzyMatchCandidate[]> {
    const trimmed = (query.query ?? '').trim();
    if (trimmed.length === 0) {
      return [];
    }
    return this.repository.fuzzyMatch({
      query: trimmed,
      threshold: query.threshold,
    });
  }
}
