// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // ─── Import isolation for @web-scraping/contracts ─────────────────────
  // The shared contracts package must NOT import from backend/ or
  // frontend/. It's the leaf of the dependency graph (see REQ-SC-4 in
  // sdd/frontend-backend-ambiguity/spec). Without this rule, a developer
  // could accidentally wire a NestJS or Angular symbol into the contracts
  // package and break the single-source-of-truth promise.
  //
  // Run via:  npx eslint --config backend/eslint.config.mjs packages/contracts/src
  // (from the monorepo root). The backend's own `pnpm --filter backend lint`
  // does not currently traverse into packages/, which is intentional — the
  // contracts package is type-only and has its own `pnpm --filter @web-scraping/contracts lint:eslint`.
  {
    files: ['packages/contracts/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // The contracts package has its own prettier config and style choices;
    // prettier complaints against contracts files are config noise, not
    // contract violations. Disable prettier for contracts files.
    rules: {
      'prettier/prettier': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/backend/**',
                '**/frontend/**',
                'backend/*',
                'frontend/*',
                '@backend/*',
                '@frontend/*',
              ],
              message:
                '@web-scraping/contracts is a pure type-only package and must not import from backend/ or frontend/. Move shared types here instead.',
            },
          ],
        },
      ],
    },
  },
);
