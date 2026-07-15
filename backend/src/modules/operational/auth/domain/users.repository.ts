import type { User } from './user.entity';

/**
 * Port that the application layer uses to load and persist User aggregates.
 *
 * Implemented in infrastructure/persistence/prisma-users.repository.ts.
 * Use cases inject the symbol token `USERS_REPOSITORY` and never see the
 * concrete class.
 */
export interface UsersRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(email: string, passwordHash: string): Promise<User>;
}

export const USERS_REPOSITORY = Symbol('UsersRepository');
