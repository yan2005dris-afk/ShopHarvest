import { Source, SourceProps, SourceStatus } from '../../domain/source.entity';
import { Source as PrismaSource } from '../../../../../generated/operational';

/** Maps a Prisma row to a Source domain entity and back. */
export class SourceMapper {
  static toDomain(row: PrismaSource): Source {
    const props: SourceProps = {
      id: row.id,
      code: row.code,
      name: row.name,
      baseUrl: row.baseUrl,
      status: row.status,
      config: (row.config as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Source.fromPersistence(props);
  }

  static toPersistence(source: Source): {
    id: string;
    code: string;
    name: string;
    baseUrl: string;
    status: SourceStatus;
    config: Record<string, unknown> | null;
  } {
    return {
      id: source.id,
      code: source.code,
      name: source.name,
      baseUrl: source.baseUrl,
      status: source.status,
      config: source.config,
    };
  }
}
