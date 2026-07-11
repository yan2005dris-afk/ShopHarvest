import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '../../generated/operational';
import { OperationalPrismaService } from '../../common/prisma/operational-prisma.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@web-scraping/contracts/categories';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: OperationalPrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    let parentPath = '';
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent category with id ${dto.parentId} not found`,
        );
      }
      parentPath = parent.path;
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: dto.name,
          parentId: dto.parentId ?? null,
          path: '', // placeholder — updated below after we know the id
        },
      });

      // Set materialized path: parentPath + "/" + selfId for children,
      // or just selfId for root nodes
      const path = dto.parentId
        ? `${parentPath}/${category.id}`
        : category.id;

      return tx.category.update({
        where: { id: category.id },
        data: { path },
      });
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (dto.parentId !== undefined) {
      // Prevent self-referencing
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      // Prevent circular reference: new parent cannot be a descendant
      if (dto.parentId) {
        const newParent = await this.prisma.category.findUnique({
          where: { id: dto.parentId },
        });
        if (!newParent) {
          throw new NotFoundException(
            `Parent category with id ${dto.parentId} not found`,
          );
        }
        if (newParent.path.startsWith(`${id}/`) || newParent.id === id) {
          throw new BadRequestException(
            'Cannot reparent a category to one of its descendants',
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const oldParentId = category.parentId;
      const newParentId = dto.parentId ?? null;

      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId ?? null }),
        },
      });

      // If parent changed, update path for this node and all descendants
      if (dto.parentId !== undefined && newParentId !== oldParentId) {
        const newPath = newParentId
          ? `${newParentId}/${updated.id}`
          : updated.id;

        // Update this node's path
        await tx.category.update({
          where: { id },
          data: { path: newPath },
        });
        updated.path = newPath;

        // Update all descendants' paths recursively
        await this.updateDescendantPaths(tx, id, newPath);
      }

      return updated;
    });
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    // Delete guard: cannot delete category with children
    if (category.children && category.children.length > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${category.children.length} child categor(ies). Remove or reparent children first.`,
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }

  async getAncestors(id: string) {
    const category = await this.findOne(id);
    if (!category.path) return [];

    const ancestorIds = category.path
      .split('/')
      .filter((part) => part !== '' && part !== id);

    if (ancestorIds.length === 0) return [];

    return this.prisma.category.findMany({
      where: { id: { in: ancestorIds } },
    });
  }

  async getDescendants(id: string) {
    const category = await this.findOne(id);
    return this.prisma.category.findMany({
      where: {
        path: { startsWith: `${category.path}/` },
      },
      orderBy: { path: 'asc' },
    });
  }

  async getChildren(id: string) {
    await this.findOne(id);
    return this.prisma.category.findMany({
      where: { parentId: id },
      orderBy: { name: 'asc' },
    });
  }

  // ── Category ↔ Source mappings ─────────────────────────────────────

  async createMapping(categoryId: string, sourceId: string, remoteCode: string) {
    // Verify both exist
    const [category, source] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: categoryId } }),
      this.prisma.source.findUnique({ where: { id: sourceId } }),
    ]);

    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }
    if (!source) {
      throw new NotFoundException(`Source with id ${sourceId} not found`);
    }

    // Check for duplicate mapping
    const existing = await this.prisma.categorySourceMapping.findUnique({
      where: { categoryId_sourceId: { categoryId, sourceId } },
    });
    if (existing) {
      throw new ConflictException(
        `Mapping between category ${categoryId} and source ${sourceId} already exists`,
      );
    }

    return this.prisma.categorySourceMapping.create({
      data: { categoryId, sourceId, remoteCode },
    });
  }

  async listMappingsByCategory(categoryId: string) {
    await this.findOne(categoryId);
    return this.prisma.categorySourceMapping.findMany({
      where: { categoryId },
      include: { source: true },
    });
  }

  async listMappingsBySource(sourceId: string) {
    return this.prisma.categorySourceMapping.findMany({
      where: { sourceId },
      include: { category: true },
    });
  }

  async removeMapping(categoryId: string, sourceId: string) {
    const existing = await this.prisma.categorySourceMapping.findUnique({
      where: { categoryId_sourceId: { categoryId, sourceId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Mapping between category ${categoryId} and source ${sourceId} not found`,
      );
    }

    return this.prisma.categorySourceMapping.delete({
      where: { categoryId_sourceId: { categoryId, sourceId } },
    });
  }

  // ── Private helpers ────────────────────────────────────────────────

  /**
   * Update descendant paths after a reparent operation.
   * Finds all direct children and recursively updates their path + children.
   */
  private async updateDescendantPaths(
    tx: Prisma.TransactionClient,
    parentId: string,
    newParentPath: string,
  ) {
    const children = await tx.category.findMany({
      where: { parentId },
    });

    for (const child of children) {
      const newPath = `${newParentPath}/${child.id}`;
      await tx.category.update({
        where: { id: child.id },
        data: { path: newPath },
      });
      await this.updateDescendantPaths(tx, child.id, newPath);
    }
  }
}
