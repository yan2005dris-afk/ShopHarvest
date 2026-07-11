import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';
import { IngestRawCaptureDto } from '@web-scraping/contracts/raw-captures';

@Injectable()
export class RawCapturesService {
  private readonly logger = new Logger(RawCapturesService.name);

  constructor(private readonly prisma: OperationalPrismaService) {}

  /**
   * Upsert a raw capture by composite key (offerId, sourceId).
   * Creates or overwrites the payload, updates capturedAt.
   */
  async upsert(dto: IngestRawCaptureDto) {
    // Verify source exists
    const source = await this.prisma.source.findUnique({
      where: { id: dto.sourceId },
    });
    if (!source) {
      throw new NotFoundException(
        `Source with id ${dto.sourceId} not found`,
      );
    }

    return this.prisma.rawCapture.upsert({
      where: {
        offerId_sourceId: {
          offerId: dto.offerId,
          sourceId: dto.sourceId,
        },
      },
      create: {
        offerId: dto.offerId,
        sourceId: dto.sourceId,
        payload: dto.payload as Record<string, unknown>,
      },
      update: {
        payload: dto.payload as Record<string, unknown>,
        capturedAt: new Date(),
      },
    });
  }

  /**
   * Find a single raw capture by composite key.
   */
  async findOne(offerId: string, sourceId: string) {
    const capture = await this.prisma.rawCapture.findUnique({
      where: {
        offerId_sourceId: { offerId, sourceId },
      },
      include: { source: true },
    });
    if (!capture) {
      throw new NotFoundException(
        `RawCapture with offerId ${offerId} and sourceId ${sourceId} not found`,
      );
    }
    return capture;
  }

  /**
   * List raw captures, optionally filtered by sourceId.
   */
  async findAll(sourceId?: string) {
    const where = sourceId ? { sourceId } : {};
    return this.prisma.rawCapture.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      include: { source: true },
    });
  }

  /**
   * Delete a raw capture by composite key.
   */
  async remove(offerId: string, sourceId: string) {
    await this.findOne(offerId, sourceId);
    return this.prisma.rawCapture.delete({
      where: {
        offerId_sourceId: { offerId, sourceId },
      },
    });
  }
}
