// @ts-self-types="./real-timers.d.ts"

// Held at load, before any test file runs: a test that fakes timers must not reach the harness's.
export const {setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask} = globalThis;
