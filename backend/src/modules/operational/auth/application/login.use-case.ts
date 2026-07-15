import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthResponseDto } from '@web-scraping/contracts/auth';
import { InvalidCredentialsError } from '../domain/auth.errors';
import { normalizeEmail } from '../domain/user.entity';
import { USERS_REPOSITORY } from '../domain/users.repository';
import type { UsersRepository } from '../domain/users.repository';
import type { JwtPayload } from './register.use-case';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly repository: UsersRepository,
    private readonly jwt: JwtService,
  ) {}

  async execute(email: string, password: string): Promise<AuthResponseDto> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.repository.findByEmail(normalizedEmail);
    // Compare against a real (or dummy) hash either way, so a missing user and
    // a wrong password return the same error and take similar time.
    const hash =
      user?.passwordHash ??
      '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok) {
      throw new InvalidCredentialsError();
    }
    return this.issueToken(user.id, user.email);
  }

  private issueToken(sub: string, email: string): AuthResponseDto {
    const payload: JwtPayload = { sub, email };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: sub, email },
    };
  }
}
