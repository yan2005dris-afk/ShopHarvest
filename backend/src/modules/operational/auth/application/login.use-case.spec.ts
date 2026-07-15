import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginUseCase } from './login.use-case';
import type { UsersRepository } from '../domain/users.repository';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let repository: jest.Mocked<UsersRepository>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(() => {
    repository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') } as any;
    useCase = new LoginUseCase(repository, jwt);
  });

  it('returns a token for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    repository.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const res = await useCase.execute('a@b.com', 'password123');

    expect(res.accessToken).toBe('signed.jwt.token');
    expect(res.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    repository.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await expect(useCase.execute('a@b.com', 'wrong')).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('rejects an unknown user with the same error (no user enumeration)', async () => {
    repository.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute('nope@b.com', 'whatever'),
    ).rejects.toThrow('Invalid credentials');
  });

  it('normalizes email (trim + lowercase) before lookup on login', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    repository.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const res = await useCase.execute('A@b.com', 'password123');

    expect(repository.findByEmail).toHaveBeenCalledWith('a@b.com');
    expect(res.user.email).toBe('a@b.com');
  });
});
