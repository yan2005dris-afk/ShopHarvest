import { defineConfig } from 'vitest/config';

/**
 * JSDOM environment so extension code that touches `window`, `document`, or
 * `chrome.runtime` at module init (e.g. the content-script handshake) can be
 * imported by tests without ReferenceErrors.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
  },
});
