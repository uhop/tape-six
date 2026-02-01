import {selectTimer} from './utils/timer.js';
import {isAssertError, isStopTest} from './State.js';
import getDeferred from './utils/getDeferred.js';
import timeout from './utils/timeout.js';
import {formatTime} from './utils/formatters.js';
import defer from './utils/defer.js';

import Tester from './Tester.js';
import './OK.js';

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

const testers = [];

export const getTesters = () => testers;
export const getTester = () => (testers.length ? testers[testers.length - 1] : null);

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
  const currentTester = getTester();
  if (currentTester) {
    return currentTester.test(name, options, testFn);
  }

  options = processArgs(name, options, testFn);
  if (!isTimerSet) {
    await selectTimer();
    isTimerSet = true;
  }
  const deferred = getDeferred();
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

export const runTests = async tests => {
  const reporter = getReporter();
  for (let i = 0; i < tests.length; ++i) {
    if (reporter.state?.stopTest) return false;
    const {options, deferred} = tests[i],
      testNumber = ++testCounter,
      tester = new Tester(testNumber, reporter);
    if (tester.state?.skip || options.skip) {
      tester.comment('SKIP test: ' + options.name);
      deferred && deferred.resolve(tester.state);
      return;
    }
    testers.push(tester);
    try {
      tester.reporter.report({
        type: 'test',
        name: options.name,
        test: testNumber,
        skip: options.skip,
        todo: options.todo,
        time: tester.timer.now()
      });
      if (options.testFn) {
        if (options.timeout && !isNaN(options.timeout) && options.timeout > 0) {
          const result = options.testFn(tester);
          if (result && typeof result == 'object' && typeof result.then == 'function') {
            const timedOut = await Promise.race([
              result.then(() => false),
              timeout(options.timeout).then(() => true)
            ]);
            if (timedOut) {
              tester.reporter.report({
                type: 'comment',
                name: 'TIMED OUT after ' + formatTime(options.timeout) + ', test: ' + options.name,
                test: testNumber,
                time: tester.timer.now()
              });
              tester.reporter.abort();
              await result;
            }
          }
        } else {
          await options.testFn(tester);
        }
      }
    } catch (error) {
      if (isStopTest(error)) {
        tester.reporter.report({
          type: 'comment',
          name: 'Stop tests: ' + String(error),
          test: testNumber,
          marker: new Error(),
          time: tester.timer.now()
        });
      } else if (isAssertError(error)) {
        tester.reporter.report({
          type: 'assert-error',
          name: String(error),
          test: testNumber,
          marker: new Error(),
          time: tester.timer.now(),
          operator: error.operator,
          generatedMessage: error.generatedMessage,
          fail: true,
          data: {
            actual: error.actual,
            expected: error.expected,
            error
          }
        });
      } else {
        tester.reporter.report({
          name: 'UNEXPECTED EXCEPTION: ' + String(error),
          test: testNumber,
          marker: new Error(),
          time: tester.timer.now(),
          operator: 'exception',
          fail: true,
          data: {
            actual: error
          }
        });
        tester.state?.failOnce &&
          tester.reporter.report({
            type: 'comment',
            name: 'Stop tests: ' + String(error),
            test: testNumber,
            marker: new Error(),
            time: tester.timer.now()
          });
      }
    }
    await tester.dispose();
    testers.pop();
    tester.reporter.report({
      type: 'end',
      name: options.name,
      test: testNumber,
      time: tester.timer.now(),
      fail: tester.state && tester.state.failed > 0
    });
    deferred && deferred.resolve(tester.state);
  }
  return true;
};

test.skip = function skip(name, options, testFn) {
  const currentTester = getTester();
  if (currentTester) {
    return currentTester.skip(name, options, testFn);
  }
  options = processArgs(name, options, testFn);
  return test({...options, skip: true});
};

test.todo = function todo(name, options, testFn) {
  const currentTester = getTester();
  if (currentTester) {
    return currentTester.todo(name, options, testFn);
  }
  options = processArgs(name, options, testFn);
  return test({...options, todo: true});
};

test.asPromise = function asPromise(name, options, testFn) {
  const currentTester = getTester();
  if (currentTester) {
    return currentTester.asPromise(name, options, testFn);
  }
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
  if (this.reporter.state?.skip) {
    this.comment('SKIP test: ' + options.name);
  } else {
    const promise = runTests([{options}]);
    this.embeddedTests.push(promise);
    return promise;
  }
};

Tester.prototype.skip = async function skip(name, options, testFn) {
  options = processArgs(name, options, testFn);
  this.comment('SKIP test: ' + options.name);
};

Tester.prototype.todo = async function todo(name, options, testFn) {
  options = processArgs(name, options, testFn);
  if (this.reporter.state?.skip) {
    this.comment('SKIP test: ' + options.name);
    return;
  }
  const promise = runTests([{options: {...options, todo: true}}]);
  this.embeddedTests.push(promise);
  return promise;
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
  const promise = runTests([{options}]);
  this.embeddedTests.push(promise);
  return promise;
};

export default test;
