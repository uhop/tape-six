import {format} from 'node:util';
import {getReporter} from '../test.js';

const consoleVerbs = {log: 1, info: 1, warn: 1, error: 1};

let originalConsole = null;
let currentReporter = null;

export const captureConsole = reporter => {
  if (reporter) currentReporter = reporter;
  if (originalConsole) return globalThis.console;
  originalConsole = globalThis.console;
  globalThis.console = new Proxy(originalConsole, {
    get(target, property, receiver) {
      const prop = Reflect.get(target, property, receiver);
      if (typeof prop === 'function') {
        if (property === 'assert') {
          return (assertion, ...args) => {
            if (assertion) return;
            const reporter = currentReporter || getReporter();
            reporter.report({type: 'console', name: format(...args), data: {method: property}});
          };
        } else if (consoleVerbs[property] === 1) {
          return (...args) => {
            const reporter = currentReporter || getReporter();
            reporter.report({type: 'console', name: format(...args), data: {method: property}});
          };
        }
      }
      return prop;
    }
  });
  return originalConsole;
};

export const getOriginalConsole = () => originalConsole;
export const getCurrentReporter = () => currentReporter;

export const setCurrentReporter = reporter => (currentReporter = reporter);

export default captureConsole;
