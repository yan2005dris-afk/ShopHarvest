/**
 * Manual mock for the `playwright` module.
 *
 * Used by jest tests that exercise the REAL pipeline/scripts/scraping/* code
 * without launching a real browser or hitting the network. Only the
 * `chromium` export is needed because that's all the scrapers import.
 *
 * Wired in via jest's `moduleNameMapper` (see jest.config.js) so it
 * intercepts `import 'playwright'` from ANY package in the test's module
 * graph — including the pipeline package's own playwright copy. This is why
 * we don't rely on `jest.mock('playwright')` alone: that only intercepts
 * the worker's hoisted playwright, not the one pipeline resolves from its
 * own node_modules.
 *
 * `jest` globals (jest.fn, etc.) are injected by the jest runtime into any
 * file loaded as part of a test, so this file works without explicit
 * imports.
 */

const fakePage = {
  goto: jest.fn().mockResolvedValue({ status: () => 200 }),
  evaluate: jest.fn().mockImplementation((_fn: unknown, cat: string) =>
    Promise.resolve([
      { titulo: `Mocked Book ${cat}-1`, precio: '£10.00', moneda: 'GBP' },
      { titulo: `Mocked Book ${cat}-2`, precio: '£20.00', moneda: 'GBP' },
    ]),
  ),
  close: jest.fn().mockResolvedValue(undefined),
};

const fakeContext = {
  newPage: jest.fn().mockResolvedValue(fakePage),
};

const fakeBrowser = {
  newContext: jest.fn().mockResolvedValue(fakeContext),
  close: jest.fn().mockResolvedValue(undefined),
};

export const chromium = {
  launch: jest.fn().mockResolvedValue(fakeBrowser),
};

export default { chromium };