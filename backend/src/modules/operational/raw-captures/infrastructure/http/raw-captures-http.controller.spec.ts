import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../../../generated/operational';
import { RawCapturesHttpController } from './raw-captures-http.controller';
import { RawCaptureSourceNotFoundError } from '../../domain/raw-capture.errors';

type UseCaseMock = { execute: jest.Mock };

const buildController = () => {
  const upsert: UseCaseMock = { execute: jest.fn() };
  const find: UseCaseMock = { execute: jest.fn() };
  const list: UseCaseMock = { execute: jest.fn() };
  const remove: UseCaseMock = { execute: jest.fn() };
  const controller = new RawCapturesHttpController(
    upsert as never,
    find as never,
    list as never,
    remove as never,
  );
  return { controller, upsert };
};

describe('RawCapturesHttpController — mapDomainError rethrow (Finding D regression)', () => {
  it('maps RawCaptureSourceNotFoundError to NotFoundException', async () => {
    const { controller, upsert } = buildController();
    upsert.execute.mockRejectedValue(
      new RawCaptureSourceNotFoundError('src_missing'),
    );

    await expect(
      controller.upsert({
        offerId: 'off_001',
        sourceId: 'src_missing',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rethrows a Prisma P2002 so the global filter maps it to 409', async () => {
    const { controller, upsert } = buildController();
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['offerId_sourceId'] },
      },
    );
    upsert.execute.mockRejectedValue(prismaError);

    await expect(
      controller.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: {},
      }),
    ).rejects.toBe(prismaError);
  });

  it('does not wrap a generic Error in HttpException(500) carrying the raw message', async () => {
    const { controller, upsert } = buildController();
    const generic = new Error('SECRET INTERNAL TRACE');
    upsert.execute.mockRejectedValue(generic);

    let caught: unknown;
    try {
      await controller.upsert({
        offerId: 'off_001',
        sourceId: 'src_001',
        payload: {},
      });
    } catch (error) {
      caught = error;
    }

    if (caught instanceof HttpException) {
      expect(caught).not.toBeInstanceOf(NotFoundException);
      const body = caught.getResponse();
      const detail =
        typeof body === 'string'
          ? body
          : (body as { message?: unknown }).message;
      if (typeof detail === 'string') {
        expect(detail).not.toContain('SECRET INTERNAL TRACE');
      }
    } else {
      expect(caught).toBe(generic);
    }
  });
});
