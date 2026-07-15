import type { FieldMappingDto } from '@web-scraping/contracts/domains';

/**
 * Pure domain entity for a Category.
 *
 * Knows nothing about NestJS, Prisma, or HTTP. Encapsulates the
 * materialized-path tree invariants: root paths collapse to the self id,
 * child paths are `${parent.path}/${self.id}`, and the in-memory mutation
 * rules the use case relies on.
 *
 * The recursive descendant path rewrite that follows a reparent runs at
 * the persistence boundary because it requires a Prisma transaction
 * client — the entity cannot hold that dependency. The use case is
 * responsible for invoking `repository.reparent(...)` which performs that
 * rewrite atomically.
 *
 * `defaultFieldMappings` reuses the `FieldMappingDto` shape from the
 * shared contracts package so the domain, mapper, and HTTP adapter all
 * agree on the wire type. The contracts package is framework-free
 * (no @nestjs/* or @prisma/* imports), so importing the type here is
 * allowed under the hexagonal purity rule.
 */
export type CategoryDefaultFieldMappings = FieldMappingDto[];

export interface CategoryProps {
  id: string;
  name: string;
  description: string | null;
  defaultFieldMappings: CategoryDefaultFieldMappings | null;
  parentId: string | null;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  id: string;
  name: string;
  description?: string | null;
  defaultFieldMappings?: CategoryDefaultFieldMappings | null;
  /**
   * Optional parent id. Set by the create use case when the caller passes
   * `parentId`; the entity still needs an explicit `assignPath()` call
   * before persistence because the child's path depends on the parent's
   * materialized path which the repository looks up first.
   */
  parentId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  defaultFieldMappings?: CategoryDefaultFieldMappings | null;
  /**
   * If present, drives a reparent. `null` re-parents to root; `undefined`
   * leaves the parent untouched.
   */
  parentId?: string | null;
}

export class Category {
  private constructor(private readonly props: CategoryProps) {}

  static create(input: CreateCategoryInput, now: Date = new Date()): Category {
    return new Category({
      id: input.id,
      name: input.name,
      description: input.description ?? null,
      defaultFieldMappings: input.defaultFieldMappings ?? null,
      parentId: input.parentId ?? null,
      // Path is set by `assignPath()` right before persistence. We seed an
      // empty string here; the create use case always overwrites it.
      path: '',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: CategoryProps): Category {
    return new Category(props);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get defaultFieldMappings(): CategoryDefaultFieldMappings | null {
    return this.props.defaultFieldMappings;
  }
  get parentId(): string | null {
    return this.props.parentId;
  }
  get path(): string {
    return this.props.path;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Renames the category and bumps updatedAt. Field-mappings and parent
   * changes flow through `update()` too — see UpdateCategoryInput.
   */
  update(input: UpdateCategoryInput, now: Date = new Date()): void {
    let mutated = false;

    if (input.name !== undefined && input.name !== this.props.name) {
      this.props.name = input.name;
      mutated = true;
    }
    if (input.description !== undefined) {
      this.props.description = input.description;
      mutated = true;
    }
    if (input.defaultFieldMappings !== undefined) {
      this.props.defaultFieldMappings = input.defaultFieldMappings;
      mutated = true;
    }
    if (
      input.parentId !== undefined &&
      input.parentId !== this.props.parentId
    ) {
      this.props.parentId = input.parentId;
      // The path itself is recomputed by the repository inside the same
      // transaction that walks the descendant subtree. We just bump updatedAt
      // here; the repo ensures the path is consistent on save.
      mutated = true;
    }

    if (mutated) {
      this.props.updatedAt = now;
    }
  }

  /**
   * The use case assigns the path right before persisting a brand-new
   * row. This helper lets it do so without exposing the private props
   * bag. Persistence-layer code MUST call `assignPath()` before `save()`
   * for new entities so the row never lands with `path = ''`.
   */
  assignPath(path: string, now: Date = new Date()): void {
    this.props.path = path;
    this.props.updatedAt = now;
  }

  toJSON(): CategoryProps {
    const cloned = this.props.defaultFieldMappings
      ? this.props.defaultFieldMappings.map((m) => ({ ...m }))
      : null;
    return {
      ...this.props,
      defaultFieldMappings: cloned,
    };
  }
}
