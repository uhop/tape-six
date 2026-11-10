// @ts-self-types="./timer.d.ts"

let timer = Date;

export const getTimer = () => timer;
export const setTimer = newTimer => (timer = newTimer);

// held at load, before a test file can fake the clock
const hostClock =
  typeof performance == 'object' && performance && typeof performance.now == 'function'
    ? {now: performance.now.bind(performance), origin: performance.timeOrigin}
    : null;

export const selectTimer = async () => {
  if (hostClock) {
    setTimer({now: () => hostClock.now() + hostClock.origin});
    return;
  }
  if (typeof process == 'object' && typeof process.exit == 'function') {
    try {
      const {performance} = await import('node:perf_hooks');
      setTimer({now: () => performance.now() + performance.timeOrigin});
      return;
    } catch {}
  }
  setTimer(Date);
};
