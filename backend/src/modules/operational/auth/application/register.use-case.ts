import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../../../generated/operational';
import * as bcrypt from 'bcryptjs';
import type { AuthResponseDto } from '@web-scraping/contracts/auth';
import { EmailAlreadyRegisteredError } from '../domain/auth.errors';
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
    // Public registration ALWAYS creates a plain 'user'. Admins are created
    // exclusively through the deterministic seeding/bootstrap flow
    // (prisma/seed.ts), never by a raceable count check on this public
    // surface. A role-based bootstrap here would let an unauthenticated
    // stranger register first on a fresh deployment and become admin.
    const passwordHash = await bcrypt.hash(
      password,
      RegisterUseCase.SALT_ROUNDS,
    );
    try {
      const user = await this.repository.create(
        normalizedEmail,
        passwordHash,
        'user',
      );
      return this.issueToken(user);
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

  private issueToken(user: User): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
