let timer = Date;

export const getTimer = () => timer;
export const setTimer = newTimer => (timer = newTimer);

export const selectTimer = async () => {
  // set HR timer
  if (typeof performance == 'object' && performance && typeof performance.now == 'function') {
    // browser or Deno
    setTimer(performance);
    return;
  }
  if (typeof process == 'object' && typeof process.exit == 'function') {
    // Node
    try {
      const {performance} = await import('perf_hooks');
      setTimer(performance);
      return;
    } catch (error) {
      // squelch
    }
  }
  setTimer(Date);
};
