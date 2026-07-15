/**
 * Domain errors thrown by the auth bounded context.
 *
 * Framework-agnostic; the HTTP adapter in `infrastructure/http` is the
 * single place that translates them into NestJS HttpExceptions. Anything
 * thrown by a use case that is NOT one of these classes is treated as an
 * unexpected error and forwarded to the global HttpExceptionFilter.
 */

export class EmailAlreadyRegisteredError extends Error {
  constructor(public readonly email: string) {
    super(`Email "${email}" is already registered`);
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class UserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User with id "${userId}" not found`);
    this.name = 'UserNotFoundError';
  }
}
