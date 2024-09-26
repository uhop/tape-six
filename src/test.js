import {selectTimer} from './utils/timer.js';
import State, {StopTest} from './State.js';
import Tester from './Tester.js';
import Deferred from './utils/Deferred.js';
import timeout from './utils/timeout.js';
import {formatTime} from './utils/formatters.js';
import defer from './utils/defer.js';

let tests = [],
  reporter = null,
  testCounter = 0,
  isConfigured = false,
  notifyCallback = null;

export const getConfiguredFlag = () => isConfigured;
export const setConfiguredFlag = value => (isConfigured = !!value);

export const registerNotifyCallback = callback => {
  if (tests.length) {
    defer(callback);
  } else {
    notifyCallback = callback;
  }
};

const processArgs = (name, options, testFn) => {
  // normalize arguments
  if (typeof name == 'function') {
    testFn = name;
    options = null;
    name = '';
  } else if (typeof name == 'object') {
    testFn = options;
    options = name;
    name = null;
  }
  if (typeof options == 'function') {
    testFn = options;
    options = null;
  }

  // normalize options
  options = {...options};
  if (name && typeof name == 'string') {
    options.name = name;
  }
  if (testFn && typeof testFn == 'function') {
    options.testFn = testFn;
  }
  if (!options.name && typeof options.testFn == 'function' && options.testFn.name) {
    options.name = options.testFn.name;
  }
  if (!options.name) {
    options.name = '(anonymous)';
  }

  return options;
};

let isTimerSet = false;
export const test = async (name, options, testFn) => {
  options = processArgs(name, options, testFn);
  if (!isTimerSet) {
    await selectTimer();
    isTimerSet = true;
  }
  const deferred = new Deferred();
  if (tests.push({options, deferred}) === 1 && notifyCallback) {
    defer(notifyCallback);
    notifyCallback = null;
  }

  return deferred.promise;
};

export const getTests = () => tests;
export const clearTests = () => (tests = []);

export const getReporter = () => reporter;
export const setReporter = newReporter => (reporter = newReporter);

export const runTests = async (rootState, tests) => {
  for (let i = 0; i < tests.length; ++i) {
    if (rootState.stopTest) return false;
    const {options, deferred} = tests[i],
      testNumber = ++testCounter,
      state = new State(rootState, options),
      tester = new Tester(state, testNumber);
    if (state.skip) {
      tester.comment('SKIP test: ' + options.name);
    } else {
      try {
        state.emit({type: 'test', name: options.name, test: testNumber, time: state.timer.now()});
        if (options.skip) {
          state.emit({
            type: 'comment',
            name: 'SKIP test: ' + options.name,
            test: testNumber,
            time: state.timer.now()
          });
        } else if (options.testFn) {
          if (options.timeout && !isNaN(options.timeout) && options.timeout > 0) {
            const result = options.testFn(tester);
            if (result && typeof result == 'object' && typeof result.then == 'function') {
              const timedOut = await Promise.race([
                result.then(() => false),
                timeout(options.timeout).then(() => true)
              ]);
              if (timedOut) {
                state.emit({
                  type: 'comment',
                  name:
                    'TIMED OUT after ' + formatTime(options.timeout) + ', test: ' + options.name,
                  test: testNumber,
                  time: state.timer.now()
                });
                await result;
              }
            }
          } else {
            await options.testFn(tester);
          }
        }
      } catch (error) {
        if (error instanceof StopTest) {
          state.emit({
            type: 'comment',
            name: 'Stop tests: ' + String(error),
            test: testNumber,
            marker: new Error(),
            time: state.timer.now()
          });
        } else {
          state.emit({
            name: 'UNEXPECTED EXCEPTION: ' + String(error),
            test: testNumber,
            marker: new Error(),
            time: state.timer.now(),
            operator: 'exception',
            fail: true,
            data: {
              actual: error
            }
          });
          state.failOnce &&
            state.emit({
              type: 'comment',
              name: 'Stop tests: ' + String(error),
              test: testNumber,
              marker: new Error(),
              time: state.timer.now()
            });
        }
      }
      state.emit({
        type: 'end',
        name: options.name,
        test: testNumber,
        time: state.timer.now(),
        fail: state.failed > 0,
        data: state
      });
      state.updateParent();
    }
    deferred && deferred.resolve(state);
  }
  return true;
};

test.skip = function skip(name, options, testFn) {
  options = processArgs(name, options, testFn);
  return test({...options, skip: true});
};

test.todo = function todo(name, options, testFn) {
  options = processArgs(name, options, testFn);
  return test({...options, todo: true});
};

test.asPromise = function asPromise(name, options, testFn) {
  options = processArgs(name, options, testFn);
  if (options.testFn) {
    const testFn = options.testFn;
    options.testFn = tester =>
      new Promise((resolve, reject) => {
        try {
          testFn(tester, resolve, reject);
        } catch (error) {
          reject(error);
        }
      });
  }
  return test(options);
};

// test() (an embedded test runner) is added here to ./Tester.js to avoid circular dependencies

Tester.prototype.test = async function test(name, options, testFn) {
  options = processArgs(name, options, testFn);
  if (this.state.skip) {
    this.comment('SKIP test: ' + options.name);
  } else {
    await runTests(this.state, [{options}]);
  }
};

Tester.prototype.skip = async function skip(name, options, testFn) {
  options = processArgs(name, options, testFn);
  this.comment('SKIP test: ' + options.name);
};

Tester.prototype.todo = async function todo(name, options, testFn) {
  options = processArgs(name, options, testFn);
  if (this.state.skip) {
    this.comment('SKIP test: ' + options.name);
    return;
  }
  await runTests(this.state, [{options: {...options, todo: true}}]);
};

Tester.prototype.asPromise = async function asPromise(name, options, testFn) {
  options = processArgs(name, options, testFn);
  if (options.testFn) {
    const testFn = options.testFn;
    options.testFn = tester =>
      new Promise((resolve, reject) => {
        try {
          testFn(tester, resolve, reject);
        } catch (error) {
          reject(error);
        }
      });
  }
  await runTests(this.state, [{options}]);
};

export default test;
