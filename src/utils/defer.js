let deferImplementation = globalThis.setTimeout;

// initialize the variable
do {
  // The selection below doesn't work
  // if (typeof queueMicrotask == 'function') {
  //   deferImplementation = globalThis.queueMicrotask;
  //   console.log('\nSelected: queueMicrotask()\n');
  //   break;
  // }

  if (typeof process == 'object' && typeof process?.nextTick == 'function') {
    deferImplementation = process.nextTick;
    break;
  }

  if (typeof setImmediate == 'function') {
    deferImplementation = setImmediate;
    break;
  }

  if (typeof window != 'object') break;
  // below are browser-only implementations

  if (typeof window.requestIdleCallback == 'function') {
    deferImplementation = window.requestIdleCallback;
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

const defer = fn => deferImplementation(fn);

export default defer;
