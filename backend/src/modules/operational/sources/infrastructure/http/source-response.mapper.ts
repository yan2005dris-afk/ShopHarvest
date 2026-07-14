import { SourceResponseDto } from '@web-scraping/contracts/sources';
import { Source } from '../../domain/source.entity';

export class SourceResponseMapper {
  static toDto(source: Source): SourceResponseDto {
    return {
      id: source.id,
      code: source.code,
      name: source.name,
      baseUrl: source.baseUrl,
      status: source.status,
      config: source.config ?? undefined,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }
}
