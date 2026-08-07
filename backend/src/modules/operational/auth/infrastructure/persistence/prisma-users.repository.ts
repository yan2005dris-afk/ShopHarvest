import { Injectable } from '@nestjs/common';
import { OperationalPrismaService } from '../../../../../common/prisma/operational-prisma.service';
import { User } from '../../domain/user.entity';
import type { UserProps, UserRole } from '../../domain/user.entity';
import type { UsersRepository } from '../../domain/users.repository';

/**
 * Prisma-backed implementation of `UsersRepository`.
 *
 * Maps Prisma `user` rows to the `User` domain entity. The `passwordHash`
 * field is a required column so the mapper always receives it.
 */
@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: OperationalPrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    if (!row) return null;
    return User.fromPersistence(this.toProps(row));
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) return null;
    return User.fromPersistence(this.toProps(row));
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  async create(
    email: string,
    passwordHash: string,
    role: UserRole,
  ): Promise<User> {
    const row = await this.prisma.user.create({
      data: { email, passwordHash, role },
    });
    return User.fromPersistence(this.toProps(row));
  }

  private toProps(row: {
    id: string;
    email: string;
    passwordHash: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserProps {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role === 'admin' ? 'admin' : 'user',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
