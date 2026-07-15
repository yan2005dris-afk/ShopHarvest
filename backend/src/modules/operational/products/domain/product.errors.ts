/**
 * Domain errors thrown by the products bounded context.
 *
 * Framework-agnostic; the HTTP adapter in `infrastructure/http` is the
 * single place that translates them into NestJS HttpExceptions. Anything
 * thrown by a use case that is NOT one of these classes is treated as an
 * unexpected error and forwarded to the global HttpExceptionFilter
 * (per the established convention from
 * sources/brands/raw-captures/categories/domains).
 */

export class ProductNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Product with id "${id}" not found`);
    this.name = 'ProductNotFoundError';
  }
}
