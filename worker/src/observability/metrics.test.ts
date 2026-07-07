/**
 * Tests for observability/metrics.ts.
 *
 * Pure-function tests — no mocks, no fixtures. Each case asserts a SPECIFIC
 * numeric/string output so the assertions would fail if the formula is
 * wrong (not a tautology).
 */
import { computeRunMetrics, buildQualityMetric } from './metrics';

describe('computeRunMetrics', () => {
  it('reports rowsScraped, rowsPersisted, and a non-negative duration on a clean run', () => {
    const startedAt = new Date('2026-07-06T02:00:00.000Z');
    const endedAt = new Date('2026-07-06T02:01:30.500Z');
    const scraped = [{}, {}, {}, {}, {}, {}];

    const m = computeRunMetrics({
      startedAt,
      endedAt,
      scrapedProducts: scraped,
      rowsPersisted: 6,
    });

    expect(m.rowsScraped).toBe(6);
    expect(m.rowsPersisted).toBe(6);
    expect(m.durationMs).toBe(90_500);
    expect(m.errorSummary).toBeNull();
  });

  it('captures the error message when an error is provided', () => {
    const m = computeRunMetrics({
      startedAt: new Date('2026-07-06T02:00:00Z'),
      endedAt: new Date('2026-07-06T02:00:05Z'),
      scrapedProducts: [],
      rowsPersisted: 0,
      error: new Error('playwright launch failed'),
    });

    expect(m.errorSummary).toBe('playwright launch failed');
    expect(m.rowsScraped).toBe(0);
    expect(m.rowsPersisted).toBe(0);
  });

  it('clamps a negative duration to 0 (clock skew between machines)', () => {
    const startedAt = new Date('2026-07-06T02:01:00Z');
    const endedAt = new Date('2026-07-06T02:00:00Z'); // BEFORE startedAt

    const m = computeRunMetrics({
      startedAt,
      endedAt,
      scrapedProducts: [],
      rowsPersisted: 0,
    });

    expect(m.durationMs).toBe(0);
  });
});

describe('buildQualityMetric', () => {
  it('computes completenessPct as rowsPersisted / rowsScraped × 100, rounded to 2 decimals', () => {
    const m = buildQualityMetric({
      rowsScraped: 6,
      rowsPersisted: 5,
      durationMs: 0,
      errorSummary: null,
    });
    expect(m.completenessPct).toBe(83.33);
  });

  it('returns 0% when there is no scraped data (avoids NaN)', () => {
    const m = buildQualityMetric({
      rowsScraped: 0,
      rowsPersisted: 0,
      durationMs: 0,
      errorSummary: null,
    });
    expect(m.completenessPct).toBe(0);
  });

  it('returns 100% when every scraped product was persisted', () => {
    const m = buildQualityMetric({
      rowsScraped: 4,
      rowsPersisted: 4,
      durationMs: 0,
      errorSummary: null,
    });
    expect(m.completenessPct).toBe(100);
  });
});
