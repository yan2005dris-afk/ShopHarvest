import type { QualityCheckResult } from '../quality-check.types';

/** Check 4: `url_producto`, when present, parses as a well-formed URL. */
export function urlWellFormedCheck(
  rows: ReadonlyArray<Record<string, unknown>>,
): QualityCheckResult {
  const failures: string[] = [];
  rows.forEach((row, i) => {
    const url = row['url_producto'];
    if (url == null || url === '') return;
    if (typeof url !== 'string') {
      failures.push(
        `row[${i}]: url_producto is not a string (${JSON.stringify(url)})`,
      );
      return;
    }
    try {
      new URL(url);
    } catch {
      failures.push(`row[${i}]: url_producto is not well-formed ("${url}")`);
    }
  });
  return { passed: failures.length === 0, failures };
}
