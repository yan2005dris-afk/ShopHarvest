import type { Category } from './category.entity';

/**
 * Port the application layer uses to load and persist Category aggregates.
 *
 * Implemented in infrastructure/persistence/prisma-categories.repository.ts.
 * Use cases inject the symbol token `CATEGORIES_REPOSITORY` and never see
 * the concrete class.
 *
 * The reparent operation is exposed as a single high-level method
 * (`reparent`) because rewriting the descendant subtree needs a Prisma
 * transaction client; threading that through the port would leak Prisma
 * types into the application layer.
 */
export interface CategoriesRepository {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;

  /**
   * Upserts the category (used for create + plain field updates). The
   * caller is responsible for calling `withPath()` first when persisting a
   * brand-new category — the implementation will refuse to write an empty
   * path for a row that does not exist yet.
   */
  save(category: Category): Promise<Category>;

  /**
   * Deletes a category by id. The implementation may throw if the row has
   * not been deleted by an earlier cascade; use cases rely on the deletion
   * guard at the domain layer to fail with `CategoryHasChildrenError`
   * before reaching this call.
   */
  delete(id: string): Promise<void>;

  /** Direct children ordered by name ascending. */
  findChildren(id: string): Promise<Category[]>;

  /** Ancestor chain (root → leaf), excluding the node itself. */
  findAncestors(id: string): Promise<Category[]>;

  /** All descendants ordered by path ascending for stable rendering. */
  findDescendants(id: string): Promise<Category[]>;

  /**
   * Atomically reparents the category to `newParentId` and rewrites the
   * `path` of every descendant to reflect the new parent. The
   * implementation owns the Prisma transaction; the use case has already
   * validated self-reference / cycle / parent existence.
   *
   * The caller passes the entity itself (not just an id) so any pending
   * field mutations — name, description, defaultFieldMappings — ride
   * along inside the same transaction. Without this, a combined
   * update+reparent would silently drop the field changes because
   * `update()` alone would not be invoked.
   */
  reparent(category: Category, newParentId: string | null): Promise<Category>;
}

export const CATEGORIES_REPOSITORY = Symbol('CategoriesRepository');
