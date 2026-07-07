import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Login request body. No length policy on password on purpose — we never
 * leak the registration rules on the login surface.
 */
export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 254, example: 'user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'whatever', description: 'Plain-text password.' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}