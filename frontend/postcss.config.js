/**
 * PostCSS config for Angular 22 + Tailwind v4.
 *
 * Angular 22's `@angular/build` builder auto-discovers this file.
 * No changes needed in angular.json — the builder wires PostCSS for us.
 *
 * Reference: https://tailwindcss.com/docs/installation/using-postcss
 */
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};