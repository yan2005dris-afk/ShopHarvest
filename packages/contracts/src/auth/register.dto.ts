import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Registration request body. Validated by NestJS ValidationPipe
 * (whitelist + transform) before reaching the controller.
 *
 * Decorator policy: @IsString / @IsEmail / @MinLength / @MaxLength live
 * here (not on consumer-side wrappers) so the contract is the source of
 * truth for both the backend and any client-side validators.
 *
 * Note: @ApiProperty decorators are intentionally omitted — Swagger /
 * OpenAPI metadata is deferred to Slice 3. class-validator decorators
 * are the source of truth for runtime validation.
 */
export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}