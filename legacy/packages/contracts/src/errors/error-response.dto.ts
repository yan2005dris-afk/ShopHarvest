import { ApiProperty } from '@nestjs/swagger';

/**
 * RFC 7807 field-level error entry. Returned in the `errors[]` array of an
 * `ErrorResponseDto` when the originating failure was a class-validator
 * `ValidationPipe` rejection.
 *
 * Mirrors the standard NestJS ValidationError projection (property +
 * constraints), without exposing internal symbols.
 */
export class ValidationErrorDto {
  @ApiProperty({
    description:
      'Field name (first identifier segment of the class-validator message).',
    example: 'email',
  })
  property!: string;

  @ApiProperty({
    description:
      'Human-readable constraint messages from class-validator (one per failed rule).',
    example: ['email must be an email'],
    type: [String],
  })
  messages!: string[];
}

/**
 * Standardized HTTP error envelope for every failure that reaches the client.
 *
 * Conforms to RFC 7807 (Problem Details for HTTP APIs):
 *   - `type`     — URI reference identifying the problem class. We use
 *                  `about:blank` per RFC 7807 §4.2 when no documentation
 *                  URL is registered for the status code.
 *   - `title`    — short, human-readable summary; mirrors the HTTP reason
 *                  phrase (`Not Found`, `Conflict`, `Bad Request`, …).
 *   - `status`   — HTTP status code echoed from the response line.
 *   - `detail`   — human-readable explanation specific to this occurrence.
 *                  For ValidationPipe failures, this is the general
 *                  "Request validation failed" message.
 *   - `instance` — URI reference identifying the specific occurrence. We
 *                  set it to the request path so the client can correlate
 *                  logs end-to-end.
 *
 * Extensions (RFC 7807 allows additional members):
 *   - `errors[]` — per-field validation breakdown, populated only when
 *                  the originating failure is a ValidationPipe rejection.
 *                  Absent for all other errors.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'RFC 7807 problem-type URI.',
    example: 'about:blank',
  })
  type!: string;

  @ApiProperty({
    description: 'RFC 7807 short summary.',
    example: 'Conflict',
  })
  title!: string;

  @ApiProperty({
    description: 'HTTP status code.',
    example: 409,
  })
  status!: number;

  @ApiProperty({
    description: 'Human-readable explanation of this specific occurrence.',
    example: 'Email already registered',
  })
  detail!: string;

  @ApiProperty({
    description: 'URI reference for this specific occurrence (request path).',
    example: '/api/auth/register',
  })
  instance!: string;

  @ApiProperty({
    description:
      'Per-field validation errors. Present only when the failure is a ' +
      'class-validator ValidationPipe rejection.',
    type: [ValidationErrorDto],
    required: false,
  })
  errors?: ValidationErrorDto[];
}