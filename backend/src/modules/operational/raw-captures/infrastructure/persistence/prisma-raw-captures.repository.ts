import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/operational';
import { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';
import { RawCapture } from '../../domain/raw-capture.entity';
import { RawCapturesRepository } from '../../domain/raw-captures.repository';
import { RawCaptureMapper } from './raw-capture.mapper';

@Injectable()
export class PrismaRawCapturesRepository implements RawCapturesRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async sourceExists(sourceId: string): Promise<boolean> {
    const source = await this.prisma.source.findUnique({
      where: { id: sourceId },
    });
    return source !== null;
  }

  async offerExists(offerId: string): Promise<boolean> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
    });
    return offer !== null;
  }

  async findByKey(
    offerId: string,
    sourceId: string,
  ): Promise<RawCapture | null> {
    const row = await this.prisma.rawCapture.findUnique({
      where: { offerId_sourceId: { offerId, sourceId } },
      include: { source: true },
    });
    return row ? RawCaptureMapper.toDomain(row) : null;
  }

  async findAll(sourceId?: string): Promise<RawCapture[]> {
    const rows = await this.prisma.rawCapture.findMany({
      where: sourceId ? { sourceId } : {},
      orderBy: { capturedAt: 'desc' },
      include: { source: true },
    });
    return rows.map((row) => RawCaptureMapper.toDomain(row));
  }

  async save(capture: RawCapture): Promise<RawCapture> {
    const data = RawCaptureMapper.toPersistence(capture);
    const row = await this.prisma.rawCapture.upsert({
      where: {
        offerId_sourceId: {
          offerId: data.offerId,
          sourceId: data.sourceId,
        },
      },
      create: {
        offerId: data.offerId,
        sourceId: data.sourceId,
        payload: data.payload as Prisma.InputJsonValue,
        status: data.status,
        attempts: data.attempts,
      },
      update: {
        payload: data.payload as Prisma.InputJsonValue,
        capturedAt: data.capturedAt,
        status: data.status,
        attempts: data.attempts,
      },
    });
    return RawCaptureMapper.toDomain(row);
  }

  async delete(offerId: string, sourceId: string): Promise<void> {
    await this.prisma.rawCapture.delete({
      where: { offerId_sourceId: { offerId, sourceId } },
    });
  }
}
