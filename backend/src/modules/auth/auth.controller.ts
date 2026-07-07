import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
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

  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.auth.register(dto.email, dto.password);
    return plainToInstance(AuthResponseDto, result, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @ApiOperation({ summary: 'Authenticate an existing user' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.auth.login(dto.email, dto.password);
    return plainToInstance(AuthResponseDto, result, {
      excludeExtraneousValues: true,
    });
  }
}
