/**
 * Smoke test for the worker tsconfig + tsc build.
 *
 * Regression coverage for CRITICAL-1 (worker build was broken because
 * `rootDir: "./src"` in tsconfig.json conflicted with the cross-package
 * import of `pipeline/scripts/scraping/aliexpress`, and `@types/node-cron`
 * was missing from package.json).
 *
 * RED phase: this test fails if `tsc -p tsconfig.build.json` exits non-zero
 * (rootDir conflict, missing types, or type errors from a void-returning
 * scrapeBooks).
 *
 * GREEN phase: after rootDir is removed from tsconfig.json, @types/node-cron
 * is added to package.json, AND `scrapeBooks()` returns the results array,
 * this test passes.
 *
 * Lives at the worker package root (not under src/) because it asserts a
 * property of the package's tsconfig, not anything inside src/.
 */
import { spawnSync } from 'child_process';
import * as path from 'path';

describe('worker tsconfig + tsc build', () => {
  const workerRoot = __dirname;
  // Resolve the tsc binary that pnpm symlinked into worker/node_modules.
  // Falls back to the workspace-root .bin if the symlink is missing.
  const localTsc = path.resolve(workerRoot, 'node_modules', '.bin', 'tsc');
  const rootTsc = path.resolve(workerRoot, '..', '..', 'node_modules', '.bin', 'tsc');
  const tscBin = require('fs').existsSync(localTsc) ? localTsc : rootTsc;

  it('tsc -p tsconfig.build.json exits 0 (cross-package import resolves)', () => {
    const result = spawnSync(tscBin, ['-p', 'tsconfig.build.json'], {
      cwd: workerRoot,
      encoding: 'utf-8',
    });

    // Capture the diagnostic only on failure to keep GREEN output clean.
    if (result.status !== 0) {
      // eslint-disable-next-line no-console
      console.error('--- tsc stdout ---\n' + result.stdout);
      // eslint-disable-next-line no-console
      console.error('--- tsc stderr ---\n' + result.stderr);
    }

    expect(result.status).toBe(0);
    // Defensive: assert no TS error markers slipped into stdout.
    expect(result.stdout + result.stderr).not.toMatch(/error TS\d+/);
  }, 60_000);
});