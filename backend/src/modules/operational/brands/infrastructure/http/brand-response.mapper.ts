import {
  BrandResponseDto,
  FuzzyMatchResultDto,
} from '@web-scraping/contracts/brands';
import { Brand } from '../../domain/brand.entity';
import type {
  FuzzyMatchCandidate,
  FuzzyMatchQuery,
} from '../../domain/brands.repository';

/**
 * Entity → HTTP DTO mappings.
 *
 * Note: BrandResponseDto uses class-transformer's @Expose decorator and the
 * legacy controller relied on plainToInstance(..., { excludeExtraneousValues:
 * true }) to project the wire shape. From these mappers we return plain
 * objects shaped to match the DTO; NestJS's ValidationPipe + the global
 * HttpExceptionFilter do not require class instances for serialization, and
 * the fields kept here are exactly the @Expose() ones on the DTO.
 */
export class BrandResponseMapper {
  static toDto(brand: Brand): BrandResponseDto {
    return {
      id: brand.id,
      name: brand.name,
      aliases: [...brand.aliases],
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
    };
  }

  static fuzzyCandidateToDto(
    candidate: FuzzyMatchCandidate,
  ): FuzzyMatchResultDto {
    return {
      brand: BrandResponseMapper.toDto(candidate.brand),
      similarity: candidate.similarity,
      lowConfidence: candidate.lowConfidence,
    };
  }
}

/**
 * Helper used by the controller to coerce a query-string threshold into the
 * typed `FuzzyMatchQuery` shape. Empty/whitespace defaults to 0.6.
 */
export function parseFuzzyMatchQuery(
  query: string,
  threshold?: string,
): FuzzyMatchQuery {
  const th = threshold ? parseFloat(threshold) : 0.6;
  return {
    query,
    threshold: Number.isFinite(th) ? th : 0.6,
  };
}
