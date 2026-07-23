import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RegisterUseCase } from './application/register.use-case';
import { LoginUseCase } from './application/login.use-case';
import { USERS_REPOSITORY } from './domain/users.repository';
import { AuthHttpController } from './infrastructure/http/auth-http.controller';
import { PrismaUsersRepository } from './infrastructure/persistence/prisma-users.repository';
import { JwtStrategy } from './common/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthHttpController],
  providers: [
    PrismaUsersRepository,
    { provide: USERS_REPOSITORY, useExisting: PrismaUsersRepository },
    RegisterUseCase,
    LoginUseCase,
    JwtStrategy,
  ],
  exports: [USERS_REPOSITORY, RegisterUseCase, LoginUseCase],
})
export class AuthModule {}
