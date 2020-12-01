let deferImplementation;

// initialize the variable
if (typeof setImmediate == 'function') {
  deferImplementation = setImmediate;
} else if (typeof window == 'object' && typeof window.postMessage == 'function' && typeof window.addEventListener == 'function') {
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
} else {
  deferImplementation = setTimeout;
}

const defer = fn => deferImplementation(fn);

export default defer;
