import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../../../generated/operational';
import * as bcrypt from 'bcryptjs';
import { RegisterUseCase } from './register.use-case';
import type { UsersRepository } from '../domain/users.repository';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let repository: jest.Mocked<UsersRepository>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(() => {
    repository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') } as any;
    useCase = new RegisterUseCase(repository, jwt);
  });

  it('hashes the password, creates the user, and returns a token', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockImplementation(
      (email: string, passwordHash: string) =>
        Promise.resolve({
          id: 'u1',
          email,
          passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any),
    );

    const res = await useCase.execute('a@b.com', 'password123');

    expect(repository.create).toHaveBeenCalledTimes(1);
    const storedHash = repository.create.mock.calls[0][1];
    // Never store plaintext; the stored value must verify against the password.
    expect(storedHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', storedHash)).toBe(true);
    expect(res).toEqual({
      accessToken: 'signed.jwt.token',
      user: { id: 'u1', email: 'a@b.com' },
    });
  });

  it('rejects a duplicate email', async () => {
    repository.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await expect(useCase.execute('a@b.com', 'password123')).rejects.toThrow(
      'already registered',
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('maps a Prisma P2002 (unique violation) to EmailAlreadyRegisteredError (TOCTOU race recovery)', async () => {
    repository.findByEmail.mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the field: `email`',
      { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
    );
    repository.create.mockRejectedValue(p2002);

    await expect(useCase.execute('a@b.com', 'password123')).rejects.toThrow(
      'already registered',
    );
  });

  it('rethrows non-P2002 create errors unchanged', async () => {
    repository.findByEmail.mockResolvedValue(null);
    const other = new Error('disk on fire');
    repository.create.mockRejectedValue(other);

    await expect(useCase.execute('a@b.com', 'password123')).rejects.toBe(other);
  });

  it('normalizes email (trim + lowercase) before lookup and creation', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockImplementation(
      (email: string, passwordHash: string) =>
        Promise.resolve({
          id: 'u1',
          email,
          passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any),
    );

    const res = await useCase.execute('  A@B.COM  ', 'password123');

    expect(repository.findByEmail).toHaveBeenCalledWith('a@b.com');
    expect(repository.create).toHaveBeenCalledWith(
      'a@b.com',
      expect.any(String),
    );
    expect(res.user.email).toBe('a@b.com');
  });
});
