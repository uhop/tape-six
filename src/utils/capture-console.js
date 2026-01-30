import {format} from 'node:util';
import {getReporter} from '../test.js';

const consoleVerbs = {log: 1, info: 1, warn: 1, error: 1};

export const captureConsole = () => {
  const console = globalThis.console;
  globalThis.console = new Proxy(console, {
    get(target, property, receiver) {
      const prop = Reflect.get(target, property, receiver);
      if (typeof prop === 'function') {
        if (property === 'assert') {
          return (assertion, ...args) => {
            if (assertion) return;
            const reporter = getReporter();
            reporter.report({type: 'console', name: format(...args), data: {method: property}});
          };
        } else if (consoleVerbs[property] === 1) {
          return (...args) => {
            const reporter = getReporter();
            reporter.report({type: 'console', name: format(...args), data: {method: property}});
          };
        }
      }
      return prop;
    }
  });
  return console;
};

export default captureConsole;
