export { AuthModule } from './auth.module';
export { RegisterUseCase } from './application/register.use-case';
export { LoginUseCase } from './application/login.use-case';
export { USERS_REPOSITORY } from './domain/users.repository';
export type { UsersRepository } from './domain/users.repository';
export { User, normalizeEmail } from './domain/user.entity';
export type { UserProps, CreateUserInput } from './domain/user.entity';
export {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UserNotFoundError,
} from './domain/auth.errors';
