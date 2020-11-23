let timer = Date;

export const getTimer = () => timer;
export const setTimer = newTimer => (timer = newTimer);

export const selectTimer = async () => {
  // set HR timer
  if (typeof window == 'object' && window.performance && typeof window.performance.now == 'function') {
    setTimer(window.performance);
  } else if (typeof process == 'object' && typeof process.exit == 'function') {
    try {
      const {performance} = await import('perf_hooks');
      setTimer(performance);
    } catch (error) {
      setTimer(Date);
    }
  } else {
    setTimer(Date);
  }
};
