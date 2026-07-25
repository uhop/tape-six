let deferImplementation = globalThis.setTimeout;

do {
  // queueMicrotask / process.nextTick were tried and rejected (the latter unreliable on Bun).
  if (typeof setImmediate == 'function') {
    deferImplementation = setImmediate;
    break;
  }

  if (typeof window != 'object') break;

  if (typeof window.requestIdleCallback == 'function') {
    // timeout bounds idle starvation — hidden iframes / headless may never go idle
    deferImplementation = fn => window.requestIdleCallback(fn, {timeout: 50});
    break;
  }

  if (typeof window.postMessage == 'function' && typeof window.addEventListener == 'function') {
    let buffer = [];
    window.addEventListener(
      'message',
      evt => {
        const src = evt.source;
        if ((src === window || src === null) && evt.data === 'tape6-process-tick') {
          evt.stopPropagation();
          if (buffer.length) {
            const tasks = buffer.slice(0);
            buffer = [];
            tasks.forEach(fn => fn());
          }
        }
      },
      true
    );
    deferImplementation = fn => {
      buffer.push(fn);
      window.postMessage('tape6-process-tick', '*');
    };
    break;
  }
} while (false);

export const defer = fn => deferImplementation(fn);

export default defer;
