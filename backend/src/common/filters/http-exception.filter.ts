import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import {
  ErrorResponseDto,
  ValidationErrorDto,
} from '@web-scraping/contracts/errors';

/**
 * RFC 7807 §4.2 says we SHOULD use `about:blank` as the problem `type`
 * when no documentation URL is registered for the status code. Centralized
 * so the literal only appears once on the wire side of the filter.
 */
export const RFC7807_TYPE_ABOUT_BLANK = 'about:blank' as const;

/**
 * Canonical detail phrases emitted by this filter. Centralizing keeps the
 * spec and the test suite aligned with a single source of truth — the
 * tests import these constants so a typo in a phrase fails both at once.
 */
export const RFC7807_MESSAGES = {
  VALIDATION_FAILED: 'Request validation failed',
  NOT_FOUND: 'Resource not found',
  UNIQUE_CONSTRAINT: 'Unique constraint violation',
  DATABASE_ERROR: 'Database error',
  UNEXPECTED: 'Unexpected error',
} as const;

/**
 * HTTP-reason-phrase lookup. RFC 7807 wants the human-readable Title-Case
 * form (`Not Found`, `Conflict`), but NestJS's `HttpStatus` enum returns
 * `SCREAMING_SNAKE_CASE` (`NOT_FOUND`, `CONFLICT`). We map the statuses
 * the API actually emits to the canonical phrase, and fall back to a
 * Title-Case conversion of `HttpStatus[status]` for any other status an
 * upstream library or RFC extension might raise.
 */
const HTTP_REASON: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Converts a NestJS `HttpStatus[code]` SCREAMING_SNAKE_CASE phrase to the
 * canonical Title-Case phrase RFC 7807 expects on the wire (`NOT_FOUND`
 * → `Not Found`). Used as the universal fallback so any unmapped status
 * still produces a sensible `title`.
 */
const toTitleCase = (snake: string): string =>
  snake
    .toLowerCase()
    .split('_')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');

const reasonFor = (status: number): string =>
  HTTP_REASON[status] ?? (toTitleCase(HttpStatus[status] ?? '') || 'Error');

/**
 * Shape of the `message` field of a NestJS `BadRequestException` thrown by
 * the global `ValidationPipe`. The pipe serializes the array of
 * `ValidationError` instances as the exception response, so we narrow it
 * here before walking it. Keeping the type private prevents accidental
 * cross-module coupling to class-validator internals.
 */
interface ValidationPipeResponse {
  message: string[] | string;
  error?: string;
  statusCode?: number;
}

/**
 * Global exception filter that converts every uncaught failure into an
 * RFC 7807 `application/problem+json` envelope.
 *
 * Mapping rules:
 *  - `HttpException` (and its subclasses: NotFoundException, ConflictException,
 *    UnauthorizedException, BadRequestException) → status preserved;
 *    title derived from the HTTP reason phrase; detail from the exception
 *    message (string or array of strings).
 *  - `BadRequestException` whose payload carries a class-validator array of
 *    messages → additionally populates `errors[]` with `ValidationErrorDto`
 *    entries so the frontend can highlight the offending fields.
 *  - `Prisma.PrismaClientKnownRequestError`:
 *      - P2002 (unique constraint) → 409 with `errors[0].property === '<field>'`
 *        parsed from `err.meta.target`.
 *      - P2025 (record not found)  → 404.
 *  - Anything else → 500 with the exception's own message in development
 *    and a fixed `'Unexpected error'` in production (no stack trace leakage).
 *
 * Registration: declared as `APP_FILTER` in `AppModule.providers` so Nest
 * applies it across every module without requiring per-controller decoration.
 *
 * @see https://www.rfc-editor.org/rfc/rfc7807
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const body = this.toBody(exception, req.url);
    res.status(body.status).json(body);
  }

  /** Visible for tests; not part of the public API. */
  toBody(exception: unknown, instance: string): ErrorResponseDto {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const title = reasonFor(status);

      // ValidationPipe throws BadRequestException with the class-validator
      // message array on the response payload. Surface it both as `detail`
      // (joined, human-readable) and as `errors[]` (per-field breakdown).
      if (
        exception instanceof BadRequestException &&
        this.isValidationPipeResponse(response)
      ) {
        const messages = response.message as string[];
        const errors: ValidationErrorDto[] = messages.map((m) => ({
          property: this.firstPathSegment(m),
          messages: [m],
        }));
        return plainToInstance(ErrorResponseDto, {
          type: RFC7807_TYPE_ABOUT_BLANK,
          title,
          status,
          detail: RFC7807_MESSAGES.VALIDATION_FAILED,
          instance,
          errors,
        });
      }

      const detail =
        typeof response === 'string'
          ? response
          : typeof response === 'object' &&
              response !== null &&
              'message' in response &&
              typeof response.message === 'string'
            ? (response as { message: string }).message
            : exception.message;

      return plainToInstance(ErrorResponseDto, {
        type: RFC7807_TYPE_ABOUT_BLANK,
        title,
        status,
        detail,
        instance,
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception, instance);
    }

    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      this.logger.error(exception);
    }
    const detail =
      !isProd && exception instanceof Error
        ? exception.message
        : RFC7807_MESSAGES.UNEXPECTED;
    return plainToInstance(ErrorResponseDto, {
      type: RFC7807_TYPE_ABOUT_BLANK,
      title: reasonFor(HttpStatus.INTERNAL_SERVER_ERROR),
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail,
      instance,
    });
  }

  private mapPrismaError(
    err: Prisma.PrismaClientKnownRequestError,
    instance: string,
  ): ErrorResponseDto {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      const fields = Array.isArray(target)
        ? (target as string[])
        : typeof target === 'string'
          ? [target]
          : [];
      const detail =
        fields.length > 0
          ? `${RFC7807_MESSAGES.UNIQUE_CONSTRAINT} on ${fields.join(', ')}`
          : RFC7807_MESSAGES.UNIQUE_CONSTRAINT;
      // When Prisma gives us no `meta.target` we still emit the canonical
      // generic detail, but we OMIT the `errors[]` array entirely rather
      // than ship `errors: []` to the wire — `[]` would force the client
      // to special-case "empty" vs. "absent" when deciding whether to
      // highlight a form field. RFC 7807 allows additional members to be
      // absent, so leaving it off matches the convention.
      return plainToInstance(ErrorResponseDto, {
        type: RFC7807_TYPE_ABOUT_BLANK,
        title: reasonFor(HttpStatus.CONFLICT),
        status: HttpStatus.CONFLICT,
        detail,
        instance,
        errors:
          fields.length > 0
            ? fields.map((property): ValidationErrorDto => {
                // Per-property message is still derived from the generic
                // detail so the wording stays consistent across the
                // array entry and the top-level `detail`.
                const msg = `${RFC7807_MESSAGES.UNIQUE_CONSTRAINT} on ${property}`;
                return {
                  property,
                  messages: [msg],
                };
              })
            : undefined,
      });
    }
    if (err.code === 'P2025') {
      return plainToInstance(ErrorResponseDto, {
        type: RFC7807_TYPE_ABOUT_BLANK,
        title: reasonFor(HttpStatus.NOT_FOUND),
        status: HttpStatus.NOT_FOUND,
        detail: RFC7807_MESSAGES.NOT_FOUND,
        instance,
      });
    }
    return plainToInstance(ErrorResponseDto, {
      type: RFC7807_TYPE_ABOUT_BLANK,
      title: reasonFor(HttpStatus.INTERNAL_SERVER_ERROR),
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: RFC7807_MESSAGES.DATABASE_ERROR,
      instance,
    });
  }

  private isValidationPipeResponse(
    response: string | object,
  ): response is ValidationPipeResponse {
    // ValidationPipe always throws BadRequestException with a message ARRAY
    // of class-validator strings. A bare `BadRequestException('plain')`
    // throws with response === 'plain' (string), and an ad-hoc
    // `BadRequestException({ message: '...' })` throws with response.message
    // as a string. Only the array form is the ValidationPipe signature.
    if (typeof response !== 'object' || response === null) return false;
    const msg = (response as { message?: unknown }).message;
    return Array.isArray(msg);
  }

  /**
   * Pulls the first identifier segment out of a class-validator message
   * (e.g. `'email must be an email'` → `'email'`).
   *
   * LIMITATION: class-validator does not include the offending field name
   * in the constraint message by default — most rules emit the message
   * verbatim and rely on the caller to cross-reference with their
   * `ValidationError.property`. We reconstruct a plausible field name
   * from the first word of the message so the frontend can highlight it,
   * but this is best-effort: for non-property rules whose message starts
   * with an adjective or verb (e.g. `'must be a valid email'`),
   * `property` will be the empty string.
   *
   * Used to populate `ValidationErrorDto.property` without coupling to
   * class-validator's internal `ValidationError` shape.
   */
  private firstPathSegment(message: string): string {
    const match = /^([\w-]+)/.exec(message);
    return match ? match[1] : '';
  }
}
