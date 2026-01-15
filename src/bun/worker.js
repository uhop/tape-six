import {format} from 'node:util';

const sanitizeMsg = msg => {
  if (msg.type !== 'end') return msg;
  const state = {};
  for (const [key, value] of Object.entries(msg.data)) {
    if (typeof value != 'number') continue;
    state[key] = value;
  }
  return {...msg, data: state};
};

const consoleVerbs = {log: 1, info: 1, warn: 1, error: 1};

addEventListener('message', async event => {
  const msg = event.data;
  try {
    const {setReporter} = await import(new URL('test.js', msg.srcName));
    setReporter(msg => postMessage(sanitizeMsg(msg)));

    if (!msg.options.dontCaptureConsole) {
      const console = globalThis.console;
      globalThis.console = new Proxy(console, {
        get(target, property, receiver) {
          const prop = Reflect.get(target, property, receiver);
          if (typeof prop === 'function') {
            if (consoleVerbs[property] === 1) {
              const type = 'console-' + property;
              return (...args) => {
                postMessage({type, name: format(...args)});
              };
            }
          }
          return prop;
        }
      });
    }

    await import(msg.testName);
  } catch (error) {
    postMessage({type: 'test', test: 0, time: 0});
    postMessage({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
    postMessage({
      name: 'fail',
      test: 0,
      marker: new Error(),
      time: 0,
      operator: 'fail',
      fail: true,
      data: {expected: true, actual: false}
    });
    postMessage({type: 'end', test: 0, time: 0, fail: true});
  }
});
