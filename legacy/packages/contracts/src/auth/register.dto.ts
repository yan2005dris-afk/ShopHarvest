import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Registration request body. Validated by NestJS ValidationPipe
 * (whitelist + transform) before reaching the controller.
 *
 * Decorator policy: @IsString / @IsEmail / @MinLength / @MaxLength live
 * here (not on consumer-side wrappers) so the contract is the source of
 * truth for both the backend and any client-side validators.
 */
export class RegisterDto {
  @ApiProperty({
    format: 'email',
    maxLength: 254,
    example: 'user@example.com',
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'password123',
    description: 'Plain-text password; bcrypt-hashed server-side.',
  })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}