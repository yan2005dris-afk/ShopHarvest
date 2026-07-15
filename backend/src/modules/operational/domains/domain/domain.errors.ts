/**
 * Domain errors thrown by the domains bounded context.
 *
 * Framework-agnostic; the HTTP adapter in `infrastructure/http` is the
 * single place that translates them into NestJS HttpExceptions. Anything
 * thrown by a use case that is NOT one of these classes is treated as an
 * unexpected error and forwarded to the global HttpExceptionFilter
 * (per the established convention from sources/brands/raw-captures/categories).
 */

export class DomainRuleNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`DomainRule with id "${id}" not found`);
    this.name = 'DomainRuleNotFoundError';
  }
}

/**
 * Thrown when a caller passes a `categoryId` that does not exist. The
 * legacy service raised `NotFoundException` with the same message before
 * delegating to Prisma; we preserve the wording so the wire response stays
 * identical and the 404 status code maps cleanly through the controller.
 */
export class DomainCategoryNotFoundError extends Error {
  constructor(public readonly categoryId: string) {
    super(`Category with id ${categoryId} not found`);
    this.name = 'DomainCategoryNotFoundError';
  }
}

/**
 * Thrown when a caller tries to create or update a domain rule with a
 * `domain` value that is already in use. Maps to 409 Conflict in the HTTP
 * layer. The Prisma adapter may also surface a `P2002` for the same
 * condition; the controller's `mapDomainError` re-throws that so the
 * global filter translates it, but use cases that pre-check uniqueness
 * (e.g. create) emit this typed error directly.
 */
export class DuplicateDomainRuleError extends Error {
  constructor(public readonly domain: string) {
    super(`DomainRule for host "${domain}" already exists`);
    this.name = 'DuplicateDomainRuleError';
  }
}
