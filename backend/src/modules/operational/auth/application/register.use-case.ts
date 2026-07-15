import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../../../generated/operational';
import * as bcrypt from 'bcryptjs';
import type { AuthResponseDto } from '@web-scraping/contracts/auth';
import {
  EmailAlreadyRegisteredError,
} from '../domain/auth.errors';
import { User, normalizeEmail } from '../domain/user.entity';
import { USERS_REPOSITORY } from '../domain/users.repository';
import type { UsersRepository } from '../domain/users.repository';
import type { JwtPayload } from '../common/jwt.strategy';

@Injectable()
export class RegisterUseCase {
  private static readonly SALT_ROUNDS = 10;

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly repository: UsersRepository,
    private readonly jwt: JwtService,
  ) {}

  async execute(email: string, password: string): Promise<AuthResponseDto> {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.repository.findByEmail(normalizedEmail);
    if (existing) {
      throw new EmailAlreadyRegisteredError(normalizedEmail);
    }
    const passwordHash = await bcrypt.hash(password, RegisterUseCase.SALT_ROUNDS);
    try {
      const user = await this.repository.create(normalizedEmail, passwordHash);
      return this.issueToken(user.id, user.email);
    } catch (err) {
      // The pre-check is a TOCTOU race window. If a concurrent request
      // inserted the same email between our findUnique and our create, the
      // unique constraint on `User.email` raises Prisma P2002. Surface that
      // as the same error the happy-path already throws.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new EmailAlreadyRegisteredError(normalizedEmail);
      }
      throw err;
    }
  }

  private issueToken(sub: string, email: string): AuthResponseDto {
    const payload: JwtPayload = { sub, email };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: sub, email },
    };
  }
}
