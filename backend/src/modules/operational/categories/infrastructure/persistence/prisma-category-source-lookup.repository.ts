import { Injectable } from '@nestjs/common';
import { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';
import type { CategorySourceLookup } from '../../domain/category-source-lookup.repository';

/**
 * Minimal source-existence adapter. Reads from the `sources` table only;
 * application-layer code never sees the full Source aggregate.
 *
 * Backs the CATEGORY_SOURCE_LOOKUP symbol token.
 */
@Injectable()
export class PrismaCategorySourceLookup implements CategorySourceLookup {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async sourceExists(sourceId: string): Promise<boolean> {
    const source = await this.prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });
    return source !== null;
  }
}
