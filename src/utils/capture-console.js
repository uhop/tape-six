import {format} from 'node:util';
import {getReporter} from '../test.js';

const consoleVerbs = {log: 1, info: 1, warn: 1, error: 1};

export const captureConsole = () => {
  const console = globalThis.console;
  globalThis.console = new Proxy(console, {
    get(target, property, receiver) {
      const prop = Reflect.get(target, property, receiver);
      if (typeof prop === 'function') {
        if (consoleVerbs[property] === 1) {
          const type = 'console-' + property;
          return (...args) => {
            const reporter = getReporter();
            reporter({type, name: format(...args)});
          };
        }
      }
      return prop;
    }
  });
  return console;
};

export default captureConsole;
