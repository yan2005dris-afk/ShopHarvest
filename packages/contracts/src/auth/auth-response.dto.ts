import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Authenticated user shape returned alongside the access token.
 */
export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'email' })
  @Expose()
  email!: string;
}

/**
 * Standard response body for POST /api/auth/register and
 * POST /api/auth/login. Used by both the controller's return type and
 * the frontend's auth.service response type.
 */
export class AuthResponseDto {
  @ApiProperty()
  @Expose()
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  @Expose()
  user!: AuthUserDto;
}