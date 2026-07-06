/** Minimal millisecond clock. `Date` satisfies it; so does a wrapped `performance`. */
export interface Timer {
  now(): number;
}

/** The current shared timer. Defaults to `Date` until `selectTimer()` upgrades it. */
export const getTimer: () => Timer;

/** Replace the shared timer; returns the new one. */
export const setTimer: (newTimer: Timer) => Timer;

/**
 * Select the best clock available: `performance.now() + performance.timeOrigin`
 * (native or via `node:perf_hooks`), falling back to `Date`.
 */
export const selectTimer: () => Promise<void>;
