import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../domain/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Declares which roles may reach a route. Combined with the global
 * `RolesGuard`, endpoints decorated with `@Roles('admin')` reject requests
 * whose JWT does not carry a matching `role` claim (403).
 *
 * Routes without `@Roles(...)` remain reachable by any authenticated user.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
