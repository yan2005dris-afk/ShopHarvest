import { HttpException, NotFoundException } from '@nestjs/common';
import { CategoriesHttpController } from './categories-http.controller';
import {
  CategoryHasChildrenError,
  CategoryNotFoundError,
  CategorySelfReferenceError,
  DuplicateCategorySourceMappingError,
  ParentCategoryNotFoundError,
  SourceNotFoundError,
} from '../../domain/category.errors';

type UseCaseMock = { execute: jest.Mock };

const buildController = () => {
  const create: UseCaseMock = { execute: jest.fn() };
  const find: UseCaseMock = { execute: jest.fn() };
  const list: UseCaseMock = { execute: jest.fn() };
  const update: UseCaseMock = { execute: jest.fn() };
  const remove: UseCaseMock = { execute: jest.fn() };
  const ancestors: UseCaseMock = { execute: jest.fn() };
  const descendants: UseCaseMock = { execute: jest.fn() };
  const children: UseCaseMock = { execute: jest.fn() };
  const createMapping: UseCaseMock = { execute: jest.fn() };
  const listMappings: UseCaseMock = { execute: jest.fn() };
  const removeMapping: UseCaseMock = { execute: jest.fn() };
  const controller = new CategoriesHttpController(
    create as never,
    find as never,
    list as never,
    update as never,
    remove as never,
    ancestors as never,
    descendants as never,
    children as never,
    createMapping as never,
    listMappings as never,
    removeMapping as never,
  );
  return {
    controller,
    create,
    find,
    update,
    remove,
    ancestors,
    descendants,
    children,
    createMapping,
    listMappings,
    removeMapping,
  };
};

describe('CategoriesHttpController — mapDomainError regression', () => {
  it('maps CategoryNotFoundError to NotFoundException', async () => {
    const { controller, find } = buildController();
    find.execute.mockRejectedValue(new CategoryNotFoundError('cat_missing'));

    await expect(controller.findOne('cat_missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps ParentCategoryNotFoundError to NotFoundException', async () => {
    const { controller, create } = buildController();
    create.execute.mockRejectedValue(
      new ParentCategoryNotFoundError('cat_missing'),
    );

    await expect(controller.create({ name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps CategorySelfReferenceError to BadRequestException', async () => {
    const { controller, update } = buildController();
    update.execute.mockRejectedValue(
      new CategorySelfReferenceError('cat_self'),
    );

    await expect(
      controller.update('cat_self', { parentId: 'cat_self' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('maps CategoryHasChildrenError to BadRequestException', async () => {
    const { controller, remove } = buildController();
    remove.execute.mockRejectedValue(
      new CategoryHasChildrenError('cat_parent', 'Parent', 2),
    );

    await expect(controller.remove('cat_parent')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('maps DuplicateCategorySourceMappingError to ConflictException', async () => {
    const { controller, createMapping } = buildController();
    createMapping.execute.mockRejectedValue(
      new DuplicateCategorySourceMappingError('cat_1', 'src_1'),
    );

    await expect(
      controller.createMapping('cat_1', {
        sourceId: 'src_1',
        remoteCode: 'x',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('maps SourceNotFoundError to NotFoundException', async () => {
    const { controller, createMapping } = buildController();
    createMapping.execute.mockRejectedValue(new SourceNotFoundError('src_1'));

    await expect(
      controller.createMapping('cat_1', {
        sourceId: 'src_1',
        remoteCode: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rethrows a generic Error so the global filter sanitizes it', async () => {
    const { controller, update } = buildController();
    const generic = new Error('SECRET INTERNAL TRACE');
    update.execute.mockRejectedValue(generic);

    let caught: unknown;
    try {
      await controller.update('cat_1', { name: 'X' });
    } catch (error) {
      caught = error;
    }

    // We never wrap unknown errors in HttpException(500) — that would leak
    // the raw `error.message` to the wire and bypass the global filter.
    expect(caught).toBe(generic);
  });

  it('does not wrap a generic Error in HttpException(500) carrying the raw message', async () => {
    const { controller, create } = buildController();
    const generic = new Error('SECRET INTERNAL TRACE');
    create.execute.mockRejectedValue(generic);

    let caught: unknown;
    try {
      await controller.create({ name: 'X' });
    } catch (error) {
      caught = error;
    }

    if (caught instanceof HttpException) {
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
