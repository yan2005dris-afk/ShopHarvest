import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../../../generated/operational';
import * as bcrypt from 'bcryptjs';
import type { AuthResponseDto } from '@web-scraping/contracts/auth';
import { EmailAlreadyRegisteredError } from '../domain/auth.errors';
import { User, normalizeEmail } from '../domain/user.entity';
import type { UserRole } from '../domain/user.entity';
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
    // Bootstrap rule: the first account on an empty users table becomes the
    // admin (no separate admin-seeding step needed). Every later registration
    // is a plain 'user' and cannot reach admin-only endpoints, so the public
    // register surface no longer grants full API access to strangers.
    const isFirstUser = (await this.repository.count()) === 0;
    const role: UserRole = isFirstUser ? 'admin' : 'user';
    const passwordHash = await bcrypt.hash(
      password,
      RegisterUseCase.SALT_ROUNDS,
    );
    try {
      const user = await this.repository.create(
        normalizedEmail,
        passwordHash,
        role,
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
