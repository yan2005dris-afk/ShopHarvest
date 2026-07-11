import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/operational';
import * as bcrypt from 'bcryptjs';
import { AuthResponseDto } from '@web-scraping/contracts/auth';
import { UsersService } from './users.service';

export interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * Trim surrounding whitespace and lowercase the email so that
 * "a@b.com", "A@B.com" and "  A@B.COM  " all resolve to the same row.
 * Exported for unit testing.
 */
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

@Injectable()
export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string): Promise<AuthResponseDto> {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.users.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(password, AuthService.SALT_ROUNDS);
    try {
      const user = await this.users.create(normalizedEmail, passwordHash);
      return this.issueToken(user.id, user.email);
    } catch (err) {
      // The pre-check is a TOCTOU race window. If a concurrent request
      // inserted the same email between our findUnique and our create, the
      // unique constraint on `User.email` raises Prisma P2002. Surface that
      // as the same 409 the happy-path already throws.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.users.findByEmail(normalizedEmail);
    // Compare against a real (or dummy) hash either way, so a missing user and
    // a wrong password return the same error and take similar time.
    const hash =
      user?.passwordHash ??
      '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid credentials');
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
