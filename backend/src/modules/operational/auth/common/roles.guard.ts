import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from '../domain/user.entity';

/**
 * Global role gate. Runs AFTER `JwtAuthGuard` (registered first in
 * `app.module.ts`), so `request.user` already carries the verified JWT
 * payload (`{ id, email, role }`).
 *
 * - No `@Roles(...)` on a route  → pass (any authenticated user).
 * - `@Roles('admin')`            → require `user.role === 'admin'`, else 403.
 *
 * A missing or unknown role claim never matches (fails closed).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();
    const userRole = request.user?.role;
    return (
      typeof userRole === 'string' &&
      requiredRoles.includes(userRole as UserRole)
    );
  }
}
