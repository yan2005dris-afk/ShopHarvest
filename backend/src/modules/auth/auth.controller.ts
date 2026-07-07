import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  AuthResponseDto,
  LoginDto,
  RegisterDto,
} from '@web-scraping/contracts/auth';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Single-source plainToInstance wrapper for auth responses. Auth rows are
   * Prisma-shaped (`User` model) and the wire DTO uses `@Expose()` to strip
   * the password hash + internal fields. Centralizing avoids repeating
   * `excludeExtraneousValues: true`, which is easy to forget on a new
   * endpoint and would leak the bcrypt hash onto the network.
   */
  private toDto<T extends object, V>(cls: new () => T, row: V): T {
    return plainToInstance(cls, row, { excludeExtraneousValues: true });
  }

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
    const result = await this.auth.register(dto.email, dto.password);
    return this.toDto(AuthResponseDto, result);
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
    const result = await this.auth.login(dto.email, dto.password);
    return this.toDto(AuthResponseDto, result);
  }
}
