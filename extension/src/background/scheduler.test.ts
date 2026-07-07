import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { postIngest } from './scheduler';

/**
 * Unit test for the scheduler's ingest POST. The fix ensures that a non-OK
 * HTTP response from /products/ingest is not treated as a successful replay,
 * so the caller (runReplay) does not stamp lastRunAt on the schedule entry.
 *
 * We test postIngest() in isolation rather than runReplay() because runReplay
 * pulls in chrome.alarms / chrome.tabs / chrome.runtime — global singletons
 * that are painful to stub from a unit test. postIngest is the boundary
 * where the bug actually lives; a false return means "do not mark success".
 */
describe('postIngest', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns true on a 2xx response', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);
    const ok = await postIngest('http://localhost:3000', null, {
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [],
      products: [{ title: 'X' }],
    });
    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns false when fetch resolves with ok=false (e.g., 401)', async () => {
    // This is the regression test for the CodeRabbit finding: a 401 used to
    // fall through and stamp entry.lastRunAt. postIngest must surface the
    // failure so the caller can skip the lastRunAt update.
    fetchSpy.mockResolvedValue({ ok: false, status: 401 } as Response);

    const ok = await postIngest('http://localhost:3000', 'tok', {
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [],
      products: [{ title: 'X' }],
    });

    expect(ok).toBe(false);
  });

  it('returns false when fetch resolves with ok=false (5xx)', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
    const ok = await postIngest('http://localhost:3000', null, {
      domain: 'temu.com',
      fieldMappings: [],
      products: [{ title: 'X' }],
    });
    expect(ok).toBe(false);
  });

  it('returns false when fetch rejects (network error)', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const ok = await postIngest('http://localhost:3000', null, {
      domain: 'temu.com',
      fieldMappings: [],
      products: [{ title: 'X' }],
    });
    expect(ok).toBe(false);
  });

  it('POSTs JSON with the Authorization header when a token is provided', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);
    await postIngest('http://localhost:3000', 'jwt-abc', {
      domain: 'temu.com',
      pageUrl: 'https://temu.com/list',
      fieldMappings: [{ canonicalField: 'title', selector: '.t', type: 'text' }],
      products: [{ title: 'X', price: '9.99' }],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toBe('http://localhost:3000/products/ingest');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer jwt-abc');
    expect(typeof init?.body).toBe('string');
    const parsed = JSON.parse(init?.body as string);
    expect(parsed.domain).toBe('temu.com');
    expect(parsed.products).toEqual([{ title: 'X', price: '9.99' }]);
  });
});
