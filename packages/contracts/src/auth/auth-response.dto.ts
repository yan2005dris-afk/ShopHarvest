import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Authenticated user shape returned alongside the access token.
 *
 * `@Expose` controls class-transformer serialization (used when the
 * controller calls `plainToInstance(AuthResponseDto, raw, …)` with
 * `{ excludeExtraneousValues: true }`). `@ApiProperty` populates the
 * OpenAPI schema rendered at `/api/docs`.
 */
export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'email', example: 'user@example.com' })
  @Expose()
  email!: string;
}

/**
 * Standard response body for POST /api/auth/register and
 * POST /api/auth/login. Used by both the controller's return type and
 * the frontend's auth.service response type.
 */
export class AuthResponseDto {
  @ApiProperty({ description: 'Signed JWT (Bearer) — 7d expiry.' })
  @Expose()
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  @Expose()
  user!: AuthUserDto;
}