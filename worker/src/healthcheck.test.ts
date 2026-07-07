/**
 * Regression test for CRITICAL-3: docker-compose.yml must declare a
 * healthcheck block on the etl-worker service (REQ-ETL-008).
 *
 * Before fix: the etl-worker service had no `healthcheck:` key, so docker
 * had no way to know whether the worker process was healthy.
 *
 * After fix: etl-worker has a `healthcheck:` block with a `test:` array
 * that docker compose can execute.
 *
 * We deliberately avoid adding js-yaml as a worker devDep — the docker-compose
 * file is small and structurally predictable, so a tiny YAML extractor is
 * enough. If the file grows complex enough to need a real parser, this test
 * should be migrated to a proper parser.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

describe('etl-worker docker-compose healthcheck (REQ-ETL-008)', () => {
  // worker/src/healthcheck.test.ts → ../../docker-compose.yml (project root).
  //   __dirname = worker/src
  //   ../       = worker/
  //   ../../    = <project root>
  const composePath = path.resolve(__dirname, '..', '..', 'docker-compose.yml');
  const composeContent = fs.readFileSync(composePath, 'utf-8');

  /** Extract the body of the `etl-worker:` top-level service block. */
  function extractEtlWorkerBlock(yaml: string): string {
    // Match `  etl-worker:` at indent 2 and capture indented children until
    // the next top-level key (indent 0) or EOF.
    const match = yaml.match(/^ {2}etl-worker:\s*\n([\s\S]*?)(?=^[a-z][a-z0-9-]*:\s*$|\Z)/m);
    if (!match) {
      throw new Error('etl-worker service not found in docker-compose.yml');
    }
    return match[1];
  }

  /** Extract the `test:` array inside the etl-worker healthcheck block. */
  function extractHealthcheckTest(etlWorkerBlock: string): string[] {
    const match = etlWorkerBlock.match(/test:\s*\[([^\]]+)\]/);
    if (!match) {
      throw new Error('healthcheck.test array not found in etl-worker block');
    }
    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''));
  }

  it('declares a healthcheck block on the etl-worker service', () => {
    const block = extractEtlWorkerBlock(composeContent);

    expect(block).toMatch(/^\s{4}healthcheck:\s*$/m);
    expect(block).toMatch(/test:\s*\[/);
    expect(block).toMatch(/interval:/);
    expect(block).toMatch(/retries:/);
  });

  it('the healthcheck test command exits 0 when invoked', () => {
    const block = extractEtlWorkerBlock(composeContent);
    const testCmd = extractHealthcheckTest(block);

    // docker-compose `test:` arrays look like ["CMD", "node", "-e", "..."].
    // We skip the leading "CMD" sentinel (a docker convention, not a binary)
    // and execute the remaining args directly to verify the command works.
    expect(testCmd[0]).toBe('CMD');
    const binary = testCmd[1];
    const args = testCmd.slice(2);
    expect(binary).toBeTruthy();

    const stdout = execFileSync(binary, args, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(typeof stdout).toBe('string');
    expect(stdout.trim().length).toBeGreaterThan(0);
  });
});