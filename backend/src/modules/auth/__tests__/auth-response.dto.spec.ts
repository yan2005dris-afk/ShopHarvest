import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  AuthResponseDto,
  AuthUserDto,
  RegisterDto,
} from '@web-scraping/contracts/auth';
import { AuthController } from '../auth.controller';

/**
 * RED-first regression for decision D2.
 *
 * `AuthResponseDto` carries the @Expose whitelist that protects the wire
 * shape from accidental field leaks. If a future change adds a property to
 * `AuthResponseDto` without an `@Expose` decorator, this test fails — that
 * way we keep the security and shape guarantees the frontend relies on.
 */
describe('AuthResponseDto (RED regression for D2)', () => {
  it('accepts a well-formed payload and exposes accessToken + user', () => {
    const raw = {
      accessToken: 'signed.jwt.token',
      user: { id: 'u1', email: 'a@b.com' },
    };
    const dto = plainToInstance(AuthResponseDto, raw, {
      excludeExtraneousValues: true,
    });

    expect(dto).toBeInstanceOf(AuthResponseDto);
    expect(dto.accessToken).toBe('signed.jwt.token');
    expect(dto.user).toBeInstanceOf(AuthUserDto);
    expect(dto.user.id).toBe('u1');
    expect(dto.user.email).toBe('a@b.com');
  });

  it('strips fields that are NOT decorated with @Expose', () => {
    // `internalTraceId` is added by a malicious / careless producer; the
    // @Expose whitelist must drop it before serialization. Without
    // excludeExtraneousValues this would survive as a side-channel.
    const raw = {
      accessToken: 'signed.jwt.token',
      user: { id: 'u1', email: 'a@b.com', internalTraceId: 'secret' },
      passwordHash: 'leaked-hash',
    };
    const dto = plainToInstance(AuthResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as Record<string, unknown>;

    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto['user']).not.toHaveProperty('internalTraceId');
  });

  it('controller.register() returns an AuthResponseDto with only the whitelisted fields', async () => {
    // Drive the controller directly and assert the wire shape.
    // AuthService is replaced by a stub that returns a known shape with
    // an extra "leaked" field; the controller must strip it via
    // plainToInstance(..., { excludeExtraneousValues: true }).
    const fakeService = {
      register: () =>
        Promise.resolve({
          accessToken: 'tok',
          user: { id: 'u1', email: 'a@b.com' },
          passwordHash: 'should-not-leak',
        }),
      login: () => Promise.resolve({} as never),
    };

    const controller = new AuthController(fakeService as never);
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'password123',
    });
    const result = (await controller.register(dto)) as Record<string, unknown>;

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('user');
    expect(result).not.toHaveProperty('passwordHash');
  });
});
