/**
 * Auth barrel — re-exports every auth DTO.
 *
 * Import patterns:
 *   import { LoginDto, RegisterDto, AuthResponseDto } from '@web-scraping/contracts/auth';
 *   import type { AuthResponseDto } from '@web-scraping/contracts/auth';
 */
export { RegisterDto } from './register.dto.js';
export { LoginDto } from './login.dto.js';
export { AuthResponseDto, AuthUserDto } from './auth-response.dto.js';