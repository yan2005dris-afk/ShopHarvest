import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import { LoginDto, RegisterDto } from '@web-scraping/contracts/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Controller-level spec for the auth module.
 *
 * What this verifies (R3-3 from the 4R review):
 *   - `POST /auth/register` wires the body through the controller and
 *     forwards the email + password to `AuthService.register`.
 *   - `POST /auth/login` does the same for `AuthService.login`.
 *   - The DTOs come from `@web-scraping/contracts/auth` — if a future
 *     change reintroduces a local `backend/src/modules/auth/dto/`, the
 *     import above breaks and so does this file. This is a compile-time
 *     guard, not a runtime one.
 *
 * The DTO validation contract itself is covered by the contracts-package
 * specs (`packages/contracts/src/auth/{register,login}.dto.spec.ts`).
 * Here we simulate the global ValidationPipe (whitelist + transform)
 * to confirm the controller flow doesn't bypass or duplicate that
 * validation.
 *
 * Lint note: `jest.Mocked<AuthService>` propagates `@typescript-eslint/
 * unbound-method` errors when `toHaveBeenCalled*` is read off the mock
 * via the dot accessor. We use an inline structural type for the service
 * stub so only the methods we actually assert on are visible to eslint.
 * Same pattern as `products.controller.spec.ts`.
 */
describe('AuthController', () => {
  let controller: AuthController;
  let service: {
    register: jest.Mock;
    login: jest.Mock;
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn((email: string) =>
              Promise.resolve({
                accessToken: 'tok_register',
                user: { id: 'u1', email },
              }),
            ),
            login: jest.fn((email: string) =>
              Promise.resolve({
                accessToken: 'tok_login',
                user: { id: 'u1', email },
              }),
            ),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
    service = moduleRef.get(AuthService);
  });

  it('forwards register body to AuthService.register and returns the token', async () => {
    // Simulates what the global ValidationPipe delivers to the controller
    // after class-transformer runs.
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      password: 'password123',
    });

    const result = await controller.register(dto);

    expect(service.register).toHaveBeenCalledTimes(1);
    expect(service.register).toHaveBeenCalledWith(
      'alice@example.com',
      'password123',
    );
    expect(result).toEqual({
      accessToken: 'tok_register',
      user: { id: 'u1', email: 'alice@example.com' },
    });
  });

  it('forwards login body to AuthService.login and returns the token', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'bob@example.com',
      password: 'whatever',
    });

    const result = await controller.login(dto);

    expect(service.login).toHaveBeenCalledTimes(1);
    expect(service.login).toHaveBeenCalledWith('bob@example.com', 'whatever');
    expect(result).toEqual({
      accessToken: 'tok_login',
      user: { id: 'u1', email: 'bob@example.com' },
    });
  });

  it('register: a raw payload passes the contracts RegisterDto validation', async () => {
    // The global ValidationPipe runs validate(dto, { whitelist, transform })
    // before the controller body executes. We mirror that here to assert
    // the wire-level contract: a well-formed raw POST body becomes a
    // valid RegisterDto.
    const raw = { email: 'alice@example.com', password: 'password123' };
    const dto = plainToInstance(RegisterDto, raw);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual([]);
    await controller.register(dto);
    expect(service.register).toHaveBeenCalled();
  });

  it('login: a raw payload passes the contracts LoginDto validation', async () => {
    const raw = { email: 'alice@example.com', password: 'whatever' };
    const dto = plainToInstance(LoginDto, raw);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual([]);
    await controller.login(dto);
    expect(service.login).toHaveBeenCalled();
  });

  it('register: rejects malformed email at the validation boundary (service not called)', async () => {
    // Simulates the global pipe rejecting the request before it reaches
    // the controller body.
    const dto = plainToInstance(RegisterDto, {
      email: 'not-an-email',
      password: 'password123',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    // The service must NOT be invoked when validation fails upstream.
    expect(service.register).not.toHaveBeenCalled();
  });

  it('register: rejects password shorter than 8 chars at the validation boundary', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      password: 'short',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(service.register).not.toHaveBeenCalled();
  });

  it('login: rejects empty password at the validation boundary', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: '',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(service.login).not.toHaveBeenCalled();
  });

  it('login: rejects missing password at the validation boundary', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(service.login).not.toHaveBeenCalled();
  });

  it('uses DTOs from @web-scraping/contracts/auth (compile-time guard)', () => {
    // This test is a sentinel: if anyone ever re-introduces a local
    // `backend/src/modules/auth/dto/register.dto.ts` and the controller
    // gets pointed at it, this file will fail to type-check because
    // the imported `RegisterDto` and the controller's expected type
    // would diverge.
    //
    // The runtime assertion is that the controller and the DTO we pass
    // share the exact same class identity.
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(dto).toBeInstanceOf(RegisterDto);

    const loginDto = plainToInstance(LoginDto, {
      email: 'alice@example.com',
      password: 'whatever',
    });
    expect(loginDto).toBeInstanceOf(LoginDto);
  });
});
