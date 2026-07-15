/**
 * Domain errors thrown by the categories bounded context.
 *
 * These are framework-agnostic; the HTTP adapter in `infrastructure/http`
 * is the single place that translates them into NestJS HttpExceptions.
 * Anything thrown by a use case that is NOT one of these classes is treated
 * as an unexpected error and forwarded to the global HttpExceptionFilter
 * (per the established convention from sources/brands/raw-captures).
 */

export class CategoryNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Category with id "${id}" not found`);
    this.name = 'CategoryNotFoundError';
  }
}

export class ParentCategoryNotFoundError extends Error {
  constructor(public readonly parentId: string) {
    super(`Parent category with id "${parentId}" not found`);
    this.name = 'ParentCategoryNotFoundError';
  }
}

/**
 * Thrown when a caller tries to make a category its own parent. Distinct
 * from the cycle error because it's a degenerate input shape, not a tree
 * invariant violation — the controller maps it to 400 BadRequest.
 */
export class CategorySelfReferenceError extends Error {
  constructor(public readonly id: string) {
    super('A category cannot be its own parent');
    this.name = 'CategorySelfReferenceError';
  }
}

/**
 * Thrown when a reparent would create a cycle by moving a node under one
 * of its own descendants. Distinct from self-reference because the new
 * parent DOES exist; the rejection is purely about tree topology.
 */
export class CategoryCycleError extends Error {
  constructor() {
    super('Cannot reparent a category to one of its descendants');
    this.name = 'CategoryCycleError';
  }
}

/**
 * Thrown by the delete guard. The legacy service rejected any delete of a
 * category that still has children, requiring the caller to remove or
 * reparent them first. We preserve that contract verbatim.
 */
export class CategoryHasChildrenError extends Error {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly childrenCount: number,
  ) {
    super(
      `Cannot delete category "${name}" because it has ${childrenCount} child categor(ies). Remove or reparent children first.`,
    );
    this.name = 'CategoryHasChildrenError';
  }
}

/**
 * Thrown when the caller asks to delete a mapping that does not exist.
 * Preserves the legacy 404 mapping of "not found".
 */
export class CategorySourceMappingNotFoundError extends Error {
  constructor(
    public readonly categoryId: string,
    public readonly sourceId: string,
  ) {
    super(
      `Mapping between category ${categoryId} and source ${sourceId} not found`,
    );
    this.name = 'CategorySourceMappingNotFoundError';
  }
}

/**
 * Thrown when a caller tries to create a (categoryId, sourceId) mapping
 * that already exists. Maps to 409 Conflict in the HTTP layer.
 */
export class DuplicateCategorySourceMappingError extends Error {
  constructor(
    public readonly categoryId: string,
    public readonly sourceId: string,
  ) {
    super(
      `Mapping between category ${categoryId} and source ${sourceId} already exists`,
    );
    this.name = 'DuplicateCategorySourceMappingError';
  }
}

/**
 * Thrown when a use case asks the source lookup whether a sourceId exists
 * and the answer is no. Maps to 404 in the HTTP layer; the message keeps
 * the legacy wording so the wire shape is unchanged.
 */
export class SourceNotFoundError extends Error {
  constructor(public readonly sourceId: string) {
    super(`Source with id ${sourceId} not found`);
    this.name = 'SourceNotFoundError';
  }
}
