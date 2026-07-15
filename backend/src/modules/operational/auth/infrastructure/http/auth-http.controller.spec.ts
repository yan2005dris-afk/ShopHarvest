import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import { LoginDto, RegisterDto } from '@web-scraping/contracts/auth';
import { AuthHttpController } from './auth-http.controller';
import { RegisterUseCase } from '../../application/register.use-case';
import { LoginUseCase } from '../../application/login.use-case';

describe('AuthHttpController', () => {
  let controller: AuthHttpController;
  let registerUseCase: { execute: jest.Mock };
  let loginUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    registerUseCase = {
      execute: jest.fn().mockImplementation((email: string) =>
        Promise.resolve({
          accessToken: 'tok_register',
          user: { id: 'u1', email },
        }),
      ),
    };
    loginUseCase = {
      execute: jest.fn().mockImplementation((email: string) =>
        Promise.resolve({
          accessToken: 'tok_login',
          user: { id: 'u1', email },
        }),
      ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthHttpController],
      providers: [
        { provide: RegisterUseCase, useValue: registerUseCase },
        { provide: LoginUseCase, useValue: loginUseCase },
      ],
    }).compile();

    controller = moduleRef.get(AuthHttpController);
  });

  it('forwards register body to RegisterUseCase and returns the token', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'alice@example.com',
      password: 'password123',
    });

    const result = await controller.register(dto);

    expect(registerUseCase.execute).toHaveBeenCalledTimes(1);
    expect(registerUseCase.execute).toHaveBeenCalledWith(
      'alice@example.com',
      'password123',
    );
    expect(result).toEqual({
      accessToken: 'tok_register',
      user: { id: 'u1', email: 'alice@example.com' },
    });
  });

  it('forwards login body to LoginUseCase and returns the token', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'bob@example.com',
      password: 'whatever',
    });

    const result = await controller.login(dto);

    expect(loginUseCase.execute).toHaveBeenCalledTimes(1);
    expect(loginUseCase.execute).toHaveBeenCalledWith(
      'bob@example.com',
      'whatever',
    );
    expect(result).toEqual({
      accessToken: 'tok_login',
      user: { id: 'u1', email: 'bob@example.com' },
    });
  });

  it('register: a raw payload passes the contracts RegisterDto validation', async () => {
    const raw = { email: 'alice@example.com', password: 'password123' };
    const dto = plainToInstance(RegisterDto, raw);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual([]);
    await controller.register(dto);
    expect(registerUseCase.execute).toHaveBeenCalled();
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
    expect(loginUseCase.execute).toHaveBeenCalled();
  });

  it('register: rejects malformed email at the validation boundary (use case not called)', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'not-an-email',
      password: 'password123',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(registerUseCase.execute).not.toHaveBeenCalled();
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
    expect(registerUseCase.execute).not.toHaveBeenCalled();
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
    expect(loginUseCase.execute).not.toHaveBeenCalled();
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
    expect(loginUseCase.execute).not.toHaveBeenCalled();
  });

  it('uses DTOs from @web-scraping/contracts/auth (compile-time guard)', () => {
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
