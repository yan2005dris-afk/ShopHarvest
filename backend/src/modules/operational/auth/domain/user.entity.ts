/**
 * Pure domain entity for a User (auth aggregate).
 *
 * Knows nothing about NestJS, Prisma, or HTTP. Encapsulates the persisted
 * shape of a user and exposes a factory method for creation.
 */

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  id: string;
  email: string;
  passwordHash: string;
}

/**
 * Trim surrounding whitespace and lowercase the email so that
 * "a@b.com", "A@B.com" and "  A@B.COM  " all resolve to the same row.
 */
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(input: CreateUserInput, now: Date = new Date()): User {
    return new User({
      id: input.id,
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJSON(): UserProps {
    return { ...this.props };
  }
}
