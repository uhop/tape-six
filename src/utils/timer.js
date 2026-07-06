// @ts-self-types="./timer.d.ts"

let timer = Date;

export const getTimer = () => timer;
export const setTimer = newTimer => (timer = newTimer);

export const selectTimer = async () => {
  if (typeof performance == 'object' && performance && typeof performance.now == 'function') {
    setTimer({now: () => performance.now() + performance.timeOrigin});
    return;
  }
  if (typeof process == 'object' && typeof process.exit == 'function') {
    try {
      const {performance} = await import('node:perf_hooks');
      setTimer({now: () => performance.now() + performance.timeOrigin});
      return;
    } catch (error) {}
  }
  setTimer(Date);
};
