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
 * HTTP-reason-phrase lookup. NestJS ships these constants on `HttpStatus`
 * (e.g. `HttpStatus[404] === 'NOT_FOUND'`), but RFC 7807 wants the
 * human-readable form (`Not Found`). We map the few statuses the API
 * actually emits back to the canonical Title-Case phrase.
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

const reasonFor = (status: number): string => HTTP_REASON[status] ?? 'Error';

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
          type: 'about:blank',
          title,
          status,
          detail: 'Request validation failed',
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
        type: 'about:blank',
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
        : 'Unexpected error';
    return plainToInstance(ErrorResponseDto, {
      type: 'about:blank',
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
          ? `Unique constraint violation on ${fields.join(', ')}`
          : 'Unique constraint violation';
      return plainToInstance(ErrorResponseDto, {
        type: 'about:blank',
        title: reasonFor(HttpStatus.CONFLICT),
        status: HttpStatus.CONFLICT,
        detail,
        instance,
        errors: fields.map(
          (property): ValidationErrorDto => ({
            property,
            messages: [detail],
          }),
        ),
      });
    }
    if (err.code === 'P2025') {
      return plainToInstance(ErrorResponseDto, {
        type: 'about:blank',
        title: reasonFor(HttpStatus.NOT_FOUND),
        status: HttpStatus.NOT_FOUND,
        detail: 'Resource not found',
        instance,
      });
    }
    return plainToInstance(ErrorResponseDto, {
      type: 'about:blank',
      title: reasonFor(HttpStatus.INTERNAL_SERVER_ERROR),
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'Database error',
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
   * Pulls the first dotted path segment out of a class-validator message
   * (e.g. `'email must be an email'` → `'email'`). Used to populate
   * `ValidationErrorDto.property` without coupling to class-validator's
   * internal `ValidationError` shape.
   */
  private firstPathSegment(message: string): string {
    const match = /^([\w-]+)/.exec(message);
    return match ? match[1] : '';
  }
}
