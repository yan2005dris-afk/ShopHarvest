/**
 * Backend-side barrel. Re-exports the auth DTOs from the shared
 * `@web-scraping/contracts` package so existing import paths in
 * controllers and tests keep working after the migration.
 *
 * Consumers SHOULD import directly from `@web-scraping/contracts/auth`,
 * but this shim keeps one release of backward compatibility.
 */
export { LoginDto, RegisterDto } from '@web-scraping/contracts/auth';
