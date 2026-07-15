/**
 * PostCSS config — Angular 22 + Tailwind v4 (CLI mode).
 *
 * No-op placeholder. With the standalone `@tailwindcss/cli` (see
 * `pnpm build:css` and `pnpm start:css`) all the work happens before
 * Angular's @angular/build ever touches a CSS file, so this hook just
 * needs to exist (it IS auto-discovered by Angular's builder and Vitest
 * through Vite) without declaring any plugin.
 *
 * Earlier versions added `autoprefixer` here, but Angular's modern
 * browser targets don't need vendor prefixes and Vite was unable to
 * resolve the module in some test environments.
 */
module.exports = {
  plugins: {},
};