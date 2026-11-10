/**
 * The host's timer functions as they were when tape-six loaded, before a test file could fake
 * them. tape-six's own timeouts, keep-alive, and deferred rethrow use these.
 */
export const setTimeout: typeof globalThis.setTimeout;
export const clearTimeout: typeof globalThis.clearTimeout;
export const setInterval: typeof globalThis.setInterval;
export const clearInterval: typeof globalThis.clearInterval;
export const queueMicrotask: typeof globalThis.queueMicrotask;
