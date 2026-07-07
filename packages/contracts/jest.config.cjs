/**
 * Minimal Jest config for `@web-scraping/contracts`.
 *
 * Why this lives in the contracts package (not only in the backend):
 *   - DTOs carry @IsEmail / @IsString / @MinLength / @MaxLength decorators
 *     that need class-validator + class-transformer at runtime. We want a
 *     place to assert those rules fail/pass at the package boundary without
 *     going through the NestJS ValidationPipe (which is wired in the
 *     backend).
 *   - Backend consumer tests (auth.controller / domains.controller) still
 *     cover the wire-level integration. This config covers the DTO
 *     surface in isolation.
 *
 * Filename note: `.cjs` is required because `package.json` declares
 * `"type": "module"`, which makes Node treat any `.js` file as ESM. The
 * `module.exports = ...` shape here is CommonJS, so we must use the `.cjs`
 * extension.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  rootDir: '.',
  // Emit decorator metadata is required for class-validator to introspect
  // the runtime type of each property. Keep this in sync with
  // tsconfig.json.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
