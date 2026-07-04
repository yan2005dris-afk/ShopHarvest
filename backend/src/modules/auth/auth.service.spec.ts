import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: { findByEmail: jest.Mock; create: jest.Mock };
  let jwt: { sign: jest.Mock };

  beforeEach(() => {
    users = { findByEmail: jest.fn(), create: jest.fn() };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    service = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('hashes the password, creates the user, and returns a token', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockImplementation((email: string, passwordHash: string) =>
        Promise.resolve({ id: 'u1', email, passwordHash }),
      );

      const res = await service.register('a@b.com', 'password123');

      expect(users.create).toHaveBeenCalledTimes(1);
      const storedHash = users.create.mock.calls[0][1] as string;
      // Never store plaintext; the stored value must verify against the password.
      expect(storedHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', storedHash)).toBe(true);
      expect(res).toEqual({
        accessToken: 'signed.jwt.token',
        user: { id: 'u1', email: 'a@b.com' },
      });
    });

    it('rejects a duplicate email', async () => {
      users.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: 'x',
      });

      await expect(service.register('a@b.com', 'password123')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash });

      const res = await service.login('a@b.com', 'password123');

      expect(res.accessToken).toBe('signed.jwt.token');
      expect(res.user).toEqual({ id: 'u1', email: 'a@b.com' });
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash });

      await expect(service.login('a@b.com', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an unknown user with the same error (no user enumeration)', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(service.login('nope@b.com', 'whatever')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
