import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  HttpExceptionFilter,
  RFC7807_MESSAGES,
  RFC7807_TYPE_ABOUT_BLANK,
} from './http-exception.filter';

/**
 * Spec 4 (REQ-ER-1, REQ-ER-2, REQ-ER-3, REQ-ER-4, REQ-ER-5) — every
 * exception that reaches the HTTP boundary must come back as an RFC 7807
 * problem-details envelope with the canonical field set:
 *
 *   type, title, status, detail, instance
 *
 * plus an optional `errors[]` for class-validator failures.
 *
 * These tests cover the filter directly (no NestJS test bed) — the
 * integration is exercised by the e2e suite.
 */
describe('HttpExceptionFilter', () => {
  const instance = '/api/auth/register';
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  describe('HttpException mapping', () => {
    it('NotFoundException → 404 with title "Not Found"', () => {
      const body = filter.toBody(
        new NotFoundException('Product missing'),
        instance,
      );
      expect(body).toMatchObject({
        type: RFC7807_TYPE_ABOUT_BLANK,
        title: 'Not Found',
        status: 404,
        detail: 'Product missing',
        instance,
      });
      expect(body.errors).toBeUndefined();
    });

    it('ConflictException → 409 with title "Conflict"', () => {
      const body = filter.toBody(
        new ConflictException('Email already registered'),
        instance,
      );
      expect(body.status).toBe(409);
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('Email already registered');
    });

    it('UnauthorizedException → 401 with title "Unauthorized"', () => {
      const body = filter.toBody(
        new UnauthorizedException('Invalid credentials'),
        instance,
      );
      expect(body.status).toBe(401);
      expect(body.title).toBe('Unauthorized');
      expect(body.detail).toBe('Invalid credentials');
    });

    it('BadRequestException (plain string) → 400 with detail from message', () => {
      const body = filter.toBody(
        new BadRequestException('malformed body'),
        instance,
      );
      expect(body.status).toBe(400);
      expect(body.title).toBe('Bad Request');
      expect(body.detail).toBe('malformed body');
    });

    it('BadRequestException (class-validator message array) → 400 with errors[]', () => {
      // This is the shape NestJS ValidationPipe throws: { message: string[], error, statusCode }.
      const ve = new BadRequestException({
        message: [
          'email must be an email',
          'password must be at least 8 chars',
        ],
        error: 'Bad Request',
        statusCode: 400,
      });
      const body = filter.toBody(ve, instance);
      expect(body.status).toBe(400);
      expect(body.title).toBe('Bad Request');
      expect(body.detail).toBe(RFC7807_MESSAGES.VALIDATION_FAILED);
      expect(body.errors).toBeDefined();
      expect(body.errors!.length).toBe(2);
      expect(body.errors![0]).toMatchObject({
        property: 'email',
        messages: ['email must be an email'],
      });
      expect(body.errors![1]).toMatchObject({
        property: 'password',
        messages: ['password must be at least 8 chars'],
      });
    });

    it('HttpException with object payload but no ValidationPipe shape → detail from message', () => {
      const ex = new BadRequestException({ message: 'just a string' });
      const body = filter.toBody(ex, instance);
      expect(body.detail).toBe('just a string');
    });

    it('HttpException(503) → title "Service Unavailable" via toTitleCase fallback', () => {
      // Regression: prior to the toTitleCase fallback, an unmapped status
      // (e.g. 503) returned the raw enum value `SERVICE_UNAVAILABLE`,
      // violating RFC 7807 §3.1 which expects the human-readable form.
      const ex = new HttpException('upstream is down', 503);
      const body = filter.toBody(ex, instance);
      expect(body.status).toBe(503);
      expect(body.title).toBe('Service Unavailable');
    });

    it('BadRequestException with array message always indicates ValidationPipe origin', () => {
      // The only way a BadRequestException payload carries a string[] is
      // through the global ValidationPipe. We assert that scenario
      // produces the validation envelope (errors[] populated), so any
      // future code that throws an array-payload BadRequestException
      // intentionally inherits the validation contract.
      const ex = new BadRequestException(['bad', 'worse']);
      const body = filter.toBody(ex, instance);
      expect(body.detail).toBe(RFC7807_MESSAGES.VALIDATION_FAILED);
      expect(body.errors).toBeDefined();
      expect(body.errors!.length).toBe(2);
    });
  });

  describe('Prisma error mapping (REQ-ER-2)', () => {
    it('P2002 unique constraint → 409 with errors[].property = field from meta.target', () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
      );
      const body = filter.toBody(p2002, instance);
      expect(body.status).toBe(409);
      expect(body.title).toBe('Conflict');
      expect(body.detail).toContain('email');
      expect(body.errors).toBeDefined();
      expect(body.errors![0].property).toBe('email');
    });

    it('P2025 record not found → 404', () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      });
      const body = filter.toBody(p2025, instance);
      expect(body.status).toBe(404);
      expect(body.title).toBe('Not Found');
      expect(body.detail).toBe(RFC7807_MESSAGES.NOT_FOUND);
    });

    it('P2002 with no meta.target → 409 with generic detail and no errors[]', () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
          meta: {},
        },
      );
      const body = filter.toBody(p2002, instance);
      expect(body.status).toBe(409);
      expect(body.detail).toBe(RFC7807_MESSAGES.UNIQUE_CONSTRAINT);
      // When Prisma omits `meta.target` we must NOT emit an empty errors
      // array — clients should be able to treat "absent" the same as
      // "no per-field data available". RFC 7807 permits additional
      // members to be absent.
      expect(body.errors).toBeUndefined();
    });

    it('Other Prisma codes → 500 with detail "Database error"', () => {
      const other = new Prisma.PrismaClientKnownRequestError('db boom', {
        code: 'P2003',
        clientVersion: 'test',
      });
      const body = filter.toBody(other, instance);
      expect(body.status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBe(RFC7807_MESSAGES.DATABASE_ERROR);
    });
  });

  describe('Unknown error handling (REQ-ER-4)', () => {
    it('Error in non-production → 500 with real message', () => {
      const previous = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      try {
        const body = filter.toBody(new Error('disk on fire'), instance);
        expect(body.status).toBe(500);
        expect(body.title).toBe('Internal Server Error');
        expect(body.detail).toBe('disk on fire');
        expect(body.instance).toBe(instance);
      } finally {
        if (previous !== undefined) process.env.NODE_ENV = previous;
      }
    });

    it('Error in production → 500 with "Unexpected error" (no leakage)', () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const body = filter.toBody(new Error('SECRET STACK TRACE'), instance);
expect(body.status).toBe(500);
        expect(body.detail).toBe(RFC7807_MESSAGES.UNEXPECTED);
        expect(body.detail).not.toContain('SECRET');
      } finally {
        if (previous !== undefined) process.env.NODE_ENV = previous;
        else delete process.env.NODE_ENV;
      }
    });

    it('Non-Error throwable in production → 500 with "Unexpected error"', () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const body = filter.toBody({ weird: 'object' }, instance);
        expect(body.status).toBe(500);
        expect(body.detail).toBe(RFC7807_MESSAGES.UNEXPECTED);
      } finally {
        if (previous !== undefined) process.env.NODE_ENV = previous;
        else delete process.env.NODE_ENV;
      }
    });
  });

  describe('RFC 7807 envelope invariants', () => {
    it('always returns type, title, status, detail, instance for any exception', () => {
      const samples: unknown[] = [
        new NotFoundException('x'),
        new ConflictException('y'),
        new Error('z'),
        'string-throwable',
        { plain: 'object' },
      ];
      for (const sample of samples) {
        const body = filter.toBody(sample, instance);
        expect(body.type).toBe(RFC7807_TYPE_ABOUT_BLANK);
        expect(typeof body.title).toBe('string');
        expect(body.title.length).toBeGreaterThan(0);
        expect(typeof body.status).toBe('number');
        expect(body.status).toBeGreaterThanOrEqual(400);
        expect(typeof body.detail).toBe('string');
        expect(body.instance).toBe(instance);
      }
    });
  });
});
