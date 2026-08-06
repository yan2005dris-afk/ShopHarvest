import type { AuthResponseDto } from '@web-scraping/contracts/auth';

/**
 * Entity → HTTP DTO mapping for auth responses.
 *
 * Returns a plain object — NestJS's serialization pipeline does not require
 * DTO class instances, and the fields kept here line up exactly with the
 * `@Expose()` ones on the contract.
 */
export class AuthResponseMapper {
  static toDto(result: AuthResponseDto): AuthResponseDto {
    return {
      accessToken: result.accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
    };
  }
}
