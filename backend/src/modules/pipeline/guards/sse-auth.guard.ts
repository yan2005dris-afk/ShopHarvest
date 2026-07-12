import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Extracts and validates a JWT from the `?token=` query parameter.
 *
 * The global `JwtAuthGuard` extracts the token from `Authorization: Bearer`,
 * which `EventSource` cannot send. Endpoints that need SSE auth must be
 * `@Public()` to bypass the global guard, and apply this guard to read
 * the token from the query string instead.
 */
@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token =
      (request.query['token'] as string) ||
      (request.query['access_token'] as string);

    if (!token) {
      throw new UnauthorizedException(
        'Missing authentication token. Provide ?token=<JWT> query parameter.',
      );
    }

    try {
      // Verify the token using the same JwtService that created it
      const payload = await this.jwtService.verifyAsync(token);
      // Attach user to request for downstream use
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
