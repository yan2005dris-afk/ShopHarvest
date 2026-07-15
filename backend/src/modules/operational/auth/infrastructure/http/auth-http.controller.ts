import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  AuthResponseDto,
  LoginDto,
  RegisterDto,
} from '@web-scraping/contracts/auth';
import { RegisterUseCase } from '../../application/register.use-case';
import { LoginUseCase } from '../../application/login.use-case';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from '../../domain/auth.errors';
import { AuthResponseMapper } from './auth-response.mapper';
import { Public } from '../../public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthHttpController {
  constructor(
    @Inject(RegisterUseCase)
    private readonly registerUseCase: RegisterUseCase,
    @Inject(LoginUseCase)
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Email already registered',
  })
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    try {
      const result = await this.registerUseCase.execute(
        dto.email,
        dto.password,
      );
      return AuthResponseMapper.toDto(result);
    } catch (error) {
      throw AuthHttpController.mapAuthError(error);
    }
  }

  @Public()
  @ApiOperation({ summary: 'Authenticate an existing user' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Invalid credentials',
  })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    try {
      const result = await this.loginUseCase.execute(dto.email, dto.password);
      return AuthResponseMapper.toDto(result);
    } catch (error) {
      throw AuthHttpController.mapAuthError(error);
    }
  }

  /**
   * Translates domain errors to NestJS HttpExceptions so the global filter
   * never sees an unhandled Error from this controller.
   * Unknown errors are rethrown and land in the global HttpExceptionFilter.
   */
  private static mapAuthError(error: unknown): never {
    if (error instanceof EmailAlreadyRegisteredError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof InvalidCredentialsError) {
      throw new UnauthorizedException(error.message);
    }
    throw error;
  }
}
