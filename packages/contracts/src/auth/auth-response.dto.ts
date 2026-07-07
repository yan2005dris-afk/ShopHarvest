import { Expose } from 'class-transformer';

/**
 * Authenticated user shape returned alongside the access token.
 *
 * Note: @ApiProperty decorators are intentionally omitted — Swagger /
 * OpenAPI metadata is deferred to Slice 3. @Expose is kept because it
 * controls class-transformer serialization (used by NestJS' built-in
 * ClassSerializerInterceptor when consuming controllers wire it up).
 */
export class AuthUserDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;
}

/**
 * Standard response body for POST /api/auth/register and
 * POST /api/auth/login. Used by both the controller's return type and
 * the frontend's auth.service response type.
 */
export class AuthResponseDto {
  @Expose()
  accessToken!: string;

  @Expose()
  user!: AuthUserDto;
}