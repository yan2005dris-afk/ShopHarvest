/**
 * Stub the `chrome.*` global used at module load time by extension source
 * files. Tests then only run the modules they actually import; this setup
 * just keeps top-level side effects (postMessage, runtime.sendMessage) from
 * throwing ReferenceError.
 */
const noop = (): void => undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: noop,
    onMessage: { addListener: noop },
  },
  tabs: { query: () => Promise.resolve([]), sendMessage: () => Promise.resolve() },
  storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } },
  alarms: { onAlarm: { addListener: noop }, create: noop, clear: () => Promise.resolve(true) },
  windows: { onStartup: { addListener: noop }, onInstalled: { addListener: noop } },
  runtime_onMessageExternal: { addListener: noop },
};
