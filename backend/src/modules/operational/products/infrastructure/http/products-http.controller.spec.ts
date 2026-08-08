import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../../../generated/operational';
import { Offer } from '../../domain/offer.entity';
import { PriceObservation } from '../../domain/price-observation.entity';
import { Product } from '../../domain/product.entity';
import { ProductNotFoundError } from '../../domain/product.errors';
import { ProductsHttpController } from './products-http.controller';

type ListUseCaseMock = {
  execute: jest.Mock;
  findAllByDomainRule: jest.Mock;
};

type ExecuteUseCaseMock = { execute: jest.Mock };

const buildOffer = () =>
  Offer.create({
    id: 'o_1',
    productId: 'p_1',
    sourceId: 's_1',
    domainRuleId: null,
    url: 'https://temu.com/x',
    currency: 'USD',
    price: 19.99,
  });

const buildProduct = (): Product =>
  Product.fromPersistence({
    id: 'p_1',
    title: 'Camisa',
    description: null,
    imageUrl: null,
    categoryId: null,
    brandId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    offers: [buildOffer()],
  });

const buildObservation = () =>
  PriceObservation.create({
    id: 'po_1',
    offerId: 'o_1',
    price: 29.5,
    currency: 'USD',
  });

const buildController = () => {
  const list: ListUseCaseMock = {
    execute: jest.fn(),
    findAllByDomainRule: jest.fn(),
  };
  const find: ExecuteUseCaseMock = { execute: jest.fn() };
  const history: ExecuteUseCaseMock = { execute: jest.fn() };
  const ingest: ExecuteUseCaseMock = { execute: jest.fn() };
  const remove: ExecuteUseCaseMock = { execute: jest.fn() };
  const controller = new ProductsHttpController(
    list as never,
    find as never,
    history as never,
    ingest as never,
    remove as never,
  );
  return { controller, list, find, history, ingest, remove };
};

describe('ProductsHttpController', () => {
  describe('happy paths', () => {
    it('returns paginated DTO envelope from listUseCase.execute() (no domainRuleId)', async () => {
      const { controller, list } = buildController();
      list.execute.mockResolvedValue({ items: [buildProduct()], total: 1 });

      const result = await controller.findAll({});

      expect(list.execute).toHaveBeenCalledWith({
        page: 1,
        limit: 24,
        q: undefined,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('p_1');
      expect(result.data[0].title).toBe('Camisa');
      expect(result.data[0].offers).toHaveLength(1);
      expect(result.data[0].offers[0].price).toBe(19.99);
      expect(result.meta).toEqual({
        page: 1,
        limit: 24,
        total: 1,
        totalPages: 1,
      });
    });

    it('forwards custom page, limit, and q to listUseCase', async () => {
      const { controller, list } = buildController();
      list.execute.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.findAll({
        page: 2,
        limit: 10,
        q: 'camisa',
      });

      expect(list.execute).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        q: 'camisa',
      });
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });

    it('uses findAllByDomainRule when domainRuleId is provided', async () => {
      const { controller, list } = buildController();
      list.findAllByDomainRule.mockResolvedValue([buildProduct()]);

      const result = await controller.findByDomain('rule_1');

      expect(list.findAllByDomainRule).toHaveBeenCalledWith('rule_1');
      expect(result).toHaveLength(1);
    });

    it('returns the mapped DTO from findUseCase.execute() in findOne', async () => {
      const { controller, find } = buildController();
      find.execute.mockResolvedValue(buildProduct());

      const dto = await controller.findOne('p_1');

      expect(find.execute).toHaveBeenCalledWith('p_1');
      expect(dto.id).toBe('p_1');
      expect(dto.title).toBe('Camisa');
      expect(dto.offers[0].price).toBe(19.99);
      expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('returns mapped DTOs from getPriceHistoryUseCase.execute()', async () => {
      const { controller, history } = buildController();
      history.execute.mockResolvedValue([buildObservation()]);

      const entries = await controller.getPriceHistory('p_1');

      expect(history.execute).toHaveBeenCalledWith('p_1', {
        from: undefined,
        to: undefined,
      });
      expect(entries[0].price).toBe(29.5);
      expect(entries[0].offerId).toBe('o_1');
    });

    it('parses ISO date strings into Date range members', async () => {
      const { controller, history } = buildController();
      history.execute.mockResolvedValue([]);

      await controller.getPriceHistory(
        'p_1',
        '2026-01-01T00:00:00.000Z',
        '2026-01-31T23:59:59.000Z',
      );

      const call = history.execute.mock.calls[0];
      expect(call[0]).toBe('p_1');
      expect(call[1].from).toBeInstanceOf(Date);
      expect(call[1].to).toBeInstanceOf(Date);
    });

    it('returns { deleted: true } after deleteUseCase.execute()', async () => {
      const { controller, remove } = buildController();
      remove.execute.mockResolvedValue(undefined);

      const out = await controller.remove('p_1');

      expect(remove.execute).toHaveBeenCalledWith('p_1');
      expect(out).toEqual({ deleted: true });
    });

    it('passes through the ingest DTO and returns the summary', async () => {
      const { controller, ingest } = buildController();
      ingest.execute.mockResolvedValue({
        ingested: 3,
        domainRuleId: 'rule_1',
      });

      const result = await controller.ingestFromExtension({
        domain: 'temu.com',
        products: [{ title: 'X' }],
      });

      expect(result).toEqual({ ingested: 3, domainRuleId: 'rule_1' });
    });
  });

  describe('mapDomainError', () => {
    it('maps ProductNotFoundError to NotFoundException on findOne', async () => {
      const { controller, find } = buildController();
      find.execute.mockRejectedValue(new ProductNotFoundError('p_missing'));

      await expect(controller.findOne('p_missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps ProductNotFoundError to NotFoundException on getPriceHistory', async () => {
      const { controller, history } = buildController();
      history.execute.mockRejectedValue(new ProductNotFoundError('p_missing'));

      await expect(
        controller.getPriceHistory('p_missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps ProductNotFoundError to NotFoundException on remove', async () => {
      const { controller, remove } = buildController();
      remove.execute.mockRejectedValue(new ProductNotFoundError('p_missing'));

      await expect(controller.remove('p_missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rethrows a Prisma P2002 so the global filter maps it to 409', async () => {
      const { controller, find } = buildController();
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['url'] },
        },
      );
      find.execute.mockRejectedValue(prismaError);

      await expect(controller.findOne('p_1')).rejects.toBe(prismaError);
    });

    it('rethrows a generic Error so the global filter sanitizes it', async () => {
      const { controller, find } = buildController();
      const generic = new Error('SECRET INTERNAL TRACE');
      find.execute.mockRejectedValue(generic);

      let caught: unknown;
      try {
        await controller.findOne('p_1');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBe(generic);
    });
  });
});
