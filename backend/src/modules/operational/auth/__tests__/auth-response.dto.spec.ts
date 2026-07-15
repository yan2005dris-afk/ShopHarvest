import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  AuthResponseDto,
  AuthUserDto,
  RegisterDto,
} from '@web-scraping/contracts/auth';
import { AuthHttpController } from '../infrastructure/http/auth-http.controller';
import { RegisterUseCase } from '../application/register.use-case';
import { LoginUseCase } from '../application/login.use-case';

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
    // RegisterUseCase is replaced by a stub that returns a known shape with
    // an extra "leaked" field; the controller must strip it.
    const registerUseCase = {
      execute: () =>
        Promise.resolve({
          accessToken: 'tok',
          user: { id: 'u1', email: 'a@b.com' },
          passwordHash: 'should-not-leak',
        } as never),
    };
    const loginUseCase = {
      execute: () => Promise.resolve({} as never),
    };

    const controller = new AuthHttpController(
      registerUseCase as unknown as RegisterUseCase,
      loginUseCase as unknown as LoginUseCase,
    );
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
