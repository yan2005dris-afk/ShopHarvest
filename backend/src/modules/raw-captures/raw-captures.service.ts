import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RawCaptureStatus } from '../../generated/operational';
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

    // Cambio SDD: product-offer-split — RawCapture.offerId is now a real
    // FK to Offer. Without this check, a non-existent offerId would fail
    // as a raw Prisma P2003 foreign-key violation (mapped to a generic 500
    // by the global exception filter) instead of a clean 404, regressing
    // this endpoint's existing error-shape contract.
    const offer = await this.prisma.offer.findUnique({
      where: { id: dto.offerId },
    });
    if (!offer) {
      throw new NotFoundException(`Offer with id ${dto.offerId} not found`);
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
        payload: dto.payload as Prisma.InputJsonValue,
        status: RawCaptureStatus.UNPROCESSED,
        attempts: 0,
      },
      update: {
        payload: dto.payload as Prisma.InputJsonValue,
        capturedAt: new Date(),
        status: RawCaptureStatus.UNPROCESSED,
        attempts: 0,
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
