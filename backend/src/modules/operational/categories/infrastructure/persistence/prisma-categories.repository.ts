import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/operational';
import { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';
import { Category } from '../../domain/category.entity';
import type { CategoriesRepository } from '../../domain/categories.repository';
import { buildCategoryPath } from '../../domain/tree-path';
import { CategoryMapper } from './category.mapper';

/**
 * Prisma-backed implementation of `CategoriesRepository`.
 *
 * Owns the recursive descendant-path rewrite during reparent operations;
 * the use case calls `reparent()` and the implementation runs the whole
 * thing inside a Prisma transaction so partial path updates never leak.
 *
 * The `reparent` flow is the only reason this implementation imports
 * `Prisma.TransactionClient` — the application layer never sees it.
 */
@Injectable()
export class PrismaCategoriesRepository implements CategoriesRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => CategoryMapper.toDomain(row));
  }

  async findById(id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row ? CategoryMapper.toDomain(row) : null;
  }

  async save(category: Category): Promise<Category> {
    const data = CategoryMapper.toPersistence(category);
    const row = await this.prisma.category.upsert({
      where: { id: data.id },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        defaultFieldMappings: data.defaultFieldMappings,
        parentId: data.parentId,
      },
    });
    return CategoryMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  async findChildren(id: string): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { parentId: id },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => CategoryMapper.toDomain(row));
  }

  async findAncestors(id: string): Promise<Category[]> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || !category.path) return [];

    const ancestorIds = category.path
      .split('/')
      .filter((part) => part !== '' && part !== id);

    if (ancestorIds.length === 0) return [];

    const rows = await this.prisma.category.findMany({
      where: { id: { in: ancestorIds } },
    });
    return rows.map((row) => CategoryMapper.toDomain(row));
  }

  async findDescendants(id: string): Promise<Category[]> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) return [];

    const rows = await this.prisma.category.findMany({
      where: { path: { startsWith: `${category.path}/` } },
      orderBy: { path: 'asc' },
    });
    return rows.map((row) => CategoryMapper.toDomain(row));
  }

  async reparent(
    category: Category,
    newParentId: string | null,
  ): Promise<Category> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.category.findUnique({
        where: { id: category.id },
      });
      if (!current) {
        // The use case already validated existence; this is a belt-and-braces
        // guard for a race with a concurrent delete.
        throw new Error(`Category ${category.id} disappeared during reparent`);
      }

      const parentPath = newParentId
        ? ((await tx.category.findUnique({ where: { id: newParentId } }))
            ?.path ?? '')
        : '';

      const newPath = buildCategoryPath(parentPath, category.id, newParentId);

      // Persist any pending field mutations on the entity alongside the
      // reparent so a combined update+reparent does not silently lose
      // name / description / defaultFieldMappings. Path is the freshly
      // computed materialized path, not the entity's stale `path`.
      const data = CategoryMapper.toPersistence(category);
      await tx.category.update({
        where: { id: category.id },
        data: {
          name: data.name,
          description: data.description,
          defaultFieldMappings: data.defaultFieldMappings,
          parentId: newParentId,
          path: newPath,
        },
      });

      await PrismaCategoriesRepository.rewriteDescendantPaths(
        tx,
        category.id,
        newPath,
      );

      const fresh = await tx.category.findUnique({
        where: { id: category.id },
      });
      if (!fresh) {
        throw new Error(`Category ${category.id} not found after reparent`);
      }
      return CategoryMapper.toDomain(fresh);
    });
  }

  /**
   * Walk the immediate children of `parentId`, rewrite each child's path
   * to reflect the new parent path, then recurse. Done inside the
   * caller's transaction so a partial failure rolls back the whole move.
   */
  private static async rewriteDescendantPaths(
    tx: Prisma.TransactionClient,
    parentId: string,
    newParentPath: string,
  ): Promise<void> {
    const children = await tx.category.findMany({
      where: { parentId },
    });
    for (const child of children) {
      const newPath = `${newParentPath}/${child.id}`;
      await tx.category.update({
        where: { id: child.id },
        data: { path: newPath },
      });
      await PrismaCategoriesRepository.rewriteDescendantPaths(
        tx,
        child.id,
        newPath,
      );
    }
  }
}
