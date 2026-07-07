import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Login request body. No length policy on password on purpose — we never
 * leak the registration rules on the login surface.
 *
 * Note: @ApiProperty decorators are intentionally omitted — Swagger /
 * OpenAPI metadata is deferred to Slice 3.
 */
export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}