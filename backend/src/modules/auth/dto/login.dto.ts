import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // No length policy here — never leak the password rules on login.
  @IsString()
  @IsNotEmpty()
  password!: string;
}
