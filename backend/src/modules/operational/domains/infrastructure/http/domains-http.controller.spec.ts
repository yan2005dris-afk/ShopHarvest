import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../../../generated/operational';
import { DomainsHttpController } from './domains-http.controller';
import {
  DomainCategoryNotFoundError,
  DomainRuleNotFoundError,
  DuplicateDomainRuleError,
} from '../../domain/domain.errors';

type UseCaseMock = { execute: jest.Mock };

const buildController = () => {
  const list: UseCaseMock = { execute: jest.fn() };
  const find: UseCaseMock = { execute: jest.fn() };
  const create: UseCaseMock = { execute: jest.fn() };
  const update: UseCaseMock = { execute: jest.fn() };
  const remove: UseCaseMock = { execute: jest.fn() };
  const controller = new DomainsHttpController(
    list as never,
    find as never,
    create as never,
    update as never,
    remove as never,
  );
  return { controller, list, find, create, update, remove };
};

describe('DomainsHttpController', () => {
  describe('happy paths', () => {
    it('returns DTOs from listUseCase in findAll', async () => {
      const { controller, list } = buildController();
      list.execute.mockResolvedValue([
        {
          rule: {
            id: 'rule_1',
            domain: 'temu.com',
            name: 'Temu',
            categoryId: 'cat_electronics',
            fieldMappings: [
              { canonicalField: 'title', selector: '.t', type: 'text' },
            ],
            containerSelector: '.product-card',
            productLimit: 50,
            sampleUrl: 'https://www.temu.com/category-1.html',
            paginationType: 'scroll',
            paginationSelector: 'button.load-more',
            lastScrapedAt: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
          },
          categoryName: 'Electronics',
        },
      ]);

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
        categoryId: 'cat_electronics',
        categoryName: 'Electronics',
        paginationType: 'scroll',
      });
      expect(result[0].fieldMappings).toEqual([
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ]);
    });

    it('forwards the optional host query parameter', async () => {
      const { controller, list } = buildController();
      list.execute.mockResolvedValue([]);
      await controller.findAll('temu.com');
      expect(list.execute).toHaveBeenCalledWith('temu.com');
    });

    it('returns the DTO from findUseCase in findOne', async () => {
      const { controller, find } = buildController();
      find.execute.mockResolvedValue({
        rule: {
          id: 'rule_1',
          domain: 'temu.com',
          name: 'Temu',
          categoryId: null,
          fieldMappings: null,
          containerSelector: null,
          productLimit: null,
          sampleUrl: null,
          paginationType: 'scroll',
          paginationSelector: null,
          lastScrapedAt: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        categoryName: null,
      });

      const dto = await controller.findOne('rule_1');
      expect(dto.id).toBe('rule_1');
      expect(dto.domain).toBe('temu.com');
    });

    it('returns { deleted: true } after remove', async () => {
      const { controller, remove } = buildController();
      remove.execute.mockResolvedValue(undefined);
      const out = await controller.remove('rule_1');
      expect(out).toEqual({ deleted: true });
      expect(remove.execute).toHaveBeenCalledWith('rule_1');
    });
  });

  describe('mapDomainError', () => {
    it('maps DomainRuleNotFoundError to NotFoundException', async () => {
      const { controller, find } = buildController();
      find.execute.mockRejectedValue(
        new DomainRuleNotFoundError('rule_missing'),
      );

      await expect(controller.findOne('rule_missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps DomainCategoryNotFoundError to NotFoundException', async () => {
      const { controller, create } = buildController();
      create.execute.mockRejectedValue(
        new DomainCategoryNotFoundError('cat_missing'),
      );

      await expect(
        controller.create({
          domain: 'temu.com',
          name: 'Temu',
          fieldMappings: [
            { canonicalField: 'title', selector: '.t', type: 'text' },
          ],
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps DuplicateDomainRuleError to ConflictException', async () => {
      const { controller, create } = buildController();
      create.execute.mockRejectedValue(
        new DuplicateDomainRuleError('temu.com'),
      );

      await expect(
        controller.create({
          domain: 'temu.com',
          name: 'Temu',
          fieldMappings: [
            { canonicalField: 'title', selector: '.t', type: 'text' },
          ],
        } as never),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('rethrows a Prisma P2002 so the global filter maps it to 409', async () => {
      const { controller, create } = buildController();
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['domain'] },
        },
      );
      create.execute.mockRejectedValue(prismaError);

      await expect(
        controller.create({
          domain: 'temu.com',
          name: 'Temu',
          fieldMappings: [
            { canonicalField: 'title', selector: '.t', type: 'text' },
          ],
        } as never),
      ).rejects.toBe(prismaError);
    });

    it('rethrows a generic Error so the global filter sanitizes it', async () => {
      const { controller, create } = buildController();
      const generic = new Error('SECRET INTERNAL TRACE');
      create.execute.mockRejectedValue(generic);

      let caught: unknown;
      try {
        await controller.create({
          domain: 'temu.com',
          name: 'Temu',
          fieldMappings: [
            { canonicalField: 'title', selector: '.t', type: 'text' },
          ],
        } as never);
      } catch (error) {
        caught = error;
      }

      // We never wrap unknown errors in HttpException(500) — that would
      // leak the raw `error.message` to the wire and bypass the global
      // filter.
      if (caught instanceof HttpException) {
        const body = caught.getResponse();
        const detail =
          typeof body === 'string'
            ? body
            : (body as { message?: unknown }).message;
        if (typeof detail === 'string') {
          expect(detail).not.toContain('SECRET INTERNAL TRACE');
        } else {
          // body had no string detail (unlikely) — fail loudly.
          throw new Error('Expected HttpException detail to be a string');
        }
      } else {
        expect(caught).toBe(generic);
      }
    });
  });
});
