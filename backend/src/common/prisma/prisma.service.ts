/**
 * Re-export shim — backward compatibility.
 *
 * The single `PrismaService` was renamed to `OperationalPrismaService`
 * during the operational/analytics database split. Existing consumers
 * (analytics, pipeline modules from PR #11) still import
 * `PrismaService` from this path. This shim forwards the old name to
 * the operational client without breaking those imports.
 *
 * New code should import `OperationalPrismaService` directly.
 */
export { OperationalPrismaService as PrismaService } from './operational-prisma.service';
