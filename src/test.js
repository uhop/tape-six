// @ts-self-types="./test.d.ts"

import {selectTimer} from './utils/timer.js';
import {isAssertionError, isStopTest} from './State.js';
import makeDeferred from './utils/makeDeferred.js';
import defer from './utils/defer.js';
import {setTimeout, clearTimeout} from './utils/real-timers.js';

import Tester from './Tester.js';
import './OK.js';

let tests = [],
  reporter = null,
  testCounter = 0,
  isConfigured = false,
  notifyCallback = new Set();

export const getConfiguredFlag = () => isConfigured;
export const setConfiguredFlag = value => (isConfigured = !!value);

const testRunnerDeferred = makeDeferred();

export const testRunner = testRunnerDeferred.promise;
export const setTestRunner = runner => testRunnerDeferred.resolve(runner);

export const registerNotifyCallback = callback => {
  if (tests.length) {
    defer(callback);
  } else {
    notifyCallback.add(callback);
  }
};

export const unregisterNotifyCallback = callback => notifyCallback.delete(callback);

const testers = [];

export const getTesters = () => testers;
export const getTester = () => (testers.length ? testers[testers.length - 1] : null);

const processArgs = (name, options, testFn) => {
  if (typeof name == 'string') {
  } else if (typeof options == 'string') {
    [name, options] = [options, name];
  } else if (typeof testFn == 'string') {
    [name, testFn] = [testFn, name];
  } else {
    [name, options, testFn] = [null, name, options];
  }
  if (typeof options == 'object') {
  } else {
    [options, testFn] = [testFn, options];
  }

  options = {...options};
  if (name && typeof name == 'string') {
    options.name = name;
  }
  if (typeof testFn == 'function') {
    options.testFn = testFn;
  }
  if (!options.name && typeof options.testFn == 'function' && options.testFn.name) {
    options.name = options.testFn.name;
  }
  if (!options.name) {
    options.name = '(anonymous)';
  }
  if (typeof options.testFn != 'function') {
    options.testFn = null;
  }

  return options;
};

let timerSelected = null;
export const test = async (name, options, testFn) => {
  const currentTester = getTester();
  if (currentTester) {
    return currentTester.test(name, options, testFn);
  }

  options = processArgs(name, options, testFn);
  await (timerSelected ??= selectTimer());
  const deferred = makeDeferred();
  if (tests.push({options, deferred}) === 1 && notifyCallback.size) {
    for (const callback of notifyCallback) defer(callback);
    notifyCallback = new Set();
  }

  return deferred.promise;
};

export const getTests = () => tests;
export const clearTests = () => void (tests = []);

export const getReporter = () => reporter;
export const setReporter = newReporter => (reporter = newReporter);

const hooks = {
  beforeAll: [],
  afterAll: [],
  beforeEach: [],
  afterEach: []
};

export const getBeforeAll = () => hooks.beforeAll;
export const clearBeforeAll = () => void (hooks.beforeAll = []);

export const getAfterAll = () => hooks.afterAll;
export const clearAfterAll = () => void (hooks.afterAll = []);

export const getBeforeEach = () => hooks.beforeEach;
export const clearBeforeEach = () => void (hooks.beforeEach = []);

export const getAfterEach = () => hooks.afterEach;
export const clearAfterEach = () => void (hooks.afterEach = []);

const abandons = new Map();

// a StopTest that reached the top level was thrown outside every body's promise chain
export const abandonTests = error => {
  for (let i = testers.length - 1; i >= 0; --i) abandons.get(testers[i])?.(error);
};

// a body abandoned or past its end: its t.test() would open a scope inside another test
const closedTesters = new WeakSet();

const reportError = (tester, error) => {
  if (isAssertionError(error)) {
    tester.reporter.report({
      type: 'assertion-error',
      name: String(error),
      test: tester.testNumber,
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
    return;
  }
  tester.reporter.report({
    type: 'assert',
    name: 'UNEXPECTED EXCEPTION: ' + String(error),
    test: tester.testNumber,
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
      test: tester.testNumber,
      marker: new Error(),
      time: tester.timer.now()
    });
};

const SETTLED = 'settled',
  TIMED_OUT = 'timed out';

let abandonedBodies = 0;
export const hasAbandonedTests = () => abandonedBodies > 0;

const settleOrAbandon = async (tester, options, result) => {
  let timer = null;
  const outcomes = [
    result.then(() => SETTLED),
    new Promise(resolve => abandons.set(tester, resolve))
  ];
  if (options.timeout && !isNaN(options.timeout) && options.timeout > 0) {
    // cleared when the body wins: a ref'd timer keeps the process alive to its end
    outcomes.push(
      new Promise(resolve => (timer = setTimeout(resolve, options.timeout, TIMED_OUT)))
    );
  }
  let outcome;
  try {
    outcome = await Promise.race(outcomes);
  } finally {
    clearTimeout(timer);
    abandons.delete(tester);
  }
  if (outcome === SETTLED) return;
  ++abandonedBodies;
  closedTesters.add(tester);
  result.then(null, error => isStopTest(error) || reportError(tester, error));
  if (outcome === TIMED_OUT) {
    try {
      tester.reporter.report({
        type: 'assert',
        name: 'Timed out after ' + options.timeout + 'ms',
        test: tester.testNumber,
        marker: new Error(),
        time: tester.timer.now(),
        operator: 'error',
        fail: true
      });
    } finally {
      tester.reporter.abort();
      // its embedded tests end first: the reporter's states nest
      for (let i = testers.indexOf(tester) + 1, n = testers.length; i < n; ++i) {
        abandons.get(testers[i])?.(null);
      }
    }
    return;
  }
  // null: its parent timed out; otherwise the StopTest that escaped it
  if (outcome) throw outcome;
};

class LateReporter {
  constructor(reporter, testName, signal) {
    this.reporter = reporter;
    this.prefix = 'LATE (from "' + testName + '"): ';
    this.ownSignal = signal;
  }
  get state() {
    return this.reporter.state;
  }
  get signal() {
    return this.ownSignal;
  }
  get timer() {
    return this.reporter.timer;
  }
  abort() {}
  report(event, suppressStopTest) {
    this.reporter.report({...event, name: this.prefix + (event.name ?? '')}, suppressStopTest);
  }
}

export const runTests = async tests => {
  const reporter = getReporter();
  if (reporter.state.stopTest) return false;
  await reporter.state.runBeforeAll();
  for (let i = 0; i < tests.length; ++i) {
    if (reporter.state.stopTest) return false;
    const {options, deferred} = tests[i],
      testNumber = ++testCounter,
      tester = new Tester(testNumber, reporter);
    if (tester.state?.skip || options.skip) {
      tester.comment('SKIP test: ' + options.name);
      deferred && deferred.resolve(tester.state);
      continue;
    }
    testers.push(tester);
    let ownSignal = null;
    try {
      await reporter.state.runBeforeEach();
      tester.reporter.report({
        type: 'test',
        name: options.name,
        test: testNumber,
        skip: options.skip,
        todo: options.todo,
        time: tester.timer.now()
      });
      ownSignal = reporter.state.signal;
      if (typeof options.beforeAll == 'function') reporter.state.beforeAll.push(options.beforeAll);
      if (typeof options.before == 'function') reporter.state.beforeAll.push(options.before);
      if (typeof options.afterAll == 'function') reporter.state.afterAll.push(options.afterAll);
      if (typeof options.after == 'function') reporter.state.afterAll.push(options.after);
      if (typeof options.beforeEach == 'function')
        reporter.state.beforeEach.push(options.beforeEach);
      if (typeof options.afterEach == 'function') reporter.state.afterEach.push(options.afterEach);
      if (options.testFn) {
        const result = options.testFn(tester);
        if (result && typeof result == 'object' && typeof result.then == 'function') {
          await settleOrAbandon(tester, options, result);
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
      } else {
        reportError(tester, error);
      }
    }
    await tester.dispose();
    await tester.state?.runAfterAll();
    testers.pop();
    if (
      tester.planned !== undefined &&
      !tester.state?.skip &&
      tester.state?.localAsserts !== tester.planned
    ) {
      tester.reporter.report({
        type: 'comment',
        name: `plan != count: expected ${tester.planned}, ran ${tester.state.localAsserts}`,
        test: testNumber,
        marker: new Error(),
        time: tester.timer.now()
      });
    }
    tester.reporter.report({
      type: 'end',
      name: options.name,
      test: testNumber,
      time: tester.timer.now(),
      // a bail-out fails no assertion — without the flag the aborted test
      // announces its end as a success to every `event.fail` consumer
      fail: tester.state?.failed > 0 || tester.state?.bailedOut
    });
    closedTesters.add(tester);
    tester.reporter = new LateReporter(reporter, options.name, ownSignal);
    await reporter.state.runAfterEach();
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

const wrapAsPromiseFn = options => {
  if (options.testFn) {
    const fn = options.testFn;
    options.testFn = tester =>
      new Promise((resolve, reject) => {
        try {
          const result = fn(tester, resolve, reject);
          // an async callback's rejection (incl. failOnce's StopTest thrown by a
          // failed assert) must reject the test, not become an unhandled rejection
          if (result && typeof result == 'object' && typeof result.then == 'function') {
            result.then(null, reject);
          }
        } catch (error) {
          reject(error);
        }
      });
  }
  return options;
};

test.asPromise = function asPromise(name, options, testFn) {
  const currentTester = getTester();
  if (currentTester) {
    return currentTester.asPromise(name, options, testFn);
  }
  return test(wrapAsPromiseFn(processArgs(name, options, testFn)));
};

// test() (an embedded test runner) is added here to ./Tester.js to avoid circular dependencies

const refuseEmbedded = (tester, options) =>
  tester.reporter.report({
    type: 'assert',
    name: 'Embedded test not run, its parent stopped: ' + options.name,
    test: tester.testNumber,
    marker: new Error(),
    time: tester.timer.now(),
    operator: 'error',
    fail: true
  });

const queueEmbedded = async function (tester, options) {
  if (closedTesters.has(tester)) return refuseEmbedded(tester, options);
  if (tester.lastEmbeddedTest) {
    const last = tester.lastEmbeddedTest,
      deferred = makeDeferred();
    tester.lastEmbeddedTest = deferred.promise;
    await last;
    if (closedTesters.has(tester)) {
      deferred.resolve();
      return refuseEmbedded(tester, options);
    }
    return runTests([{options}]).then(deferred.resolve, deferred.reject);
  }
  return (tester.lastEmbeddedTest = runTests([{options}]));
};

Tester.prototype.test = async function test(name, options, testFn) {
  options = processArgs(name, options, testFn);
  if (!this.state?.skip) return queueEmbedded(this, options);
  this.comment('SKIP test: ' + options.name);
};

Tester.prototype.skip = async function skip(name, options, testFn) {
  options = processArgs(name, options, testFn);
  this.comment('SKIP test: ' + options.name);
};

Tester.prototype.todo = async function todo(name, options, testFn) {
  options = processArgs(name, options, testFn);
  if (!this.state?.skip) return queueEmbedded(this, {...options, todo: true});
  this.comment('SKIP test: ' + options.name);
};

Tester.prototype.asPromise = async function asPromise(name, options, testFn) {
  options = processArgs(name, options, testFn);
  if (!this.state?.skip) return queueEmbedded(this, wrapAsPromiseFn(options));
  this.comment('SKIP test: ' + options.name);
};

const addToHook = name => fn => {
  if (testers.length) {
    const tester = testers[testers.length - 1];
    if (tester.state) return void tester.state[name].push(fn);
  }
  hooks[name].push(fn);
};

export const beforeAll = addToHook('beforeAll');
export const afterAll = addToHook('afterAll');

export const beforeEach = addToHook('beforeEach');
export const afterEach = addToHook('afterEach');

test.before = test.beforeAll = beforeAll;
test.after = test.afterAll = afterAll;
test.beforeEach = beforeEach;
test.afterEach = afterEach;

const addHookToTester = name =>
  function (fn) {
    this.state[name].push(fn);
  };

Tester.prototype.before = Tester.prototype.beforeAll = addHookToTester('beforeAll');
Tester.prototype.after = Tester.prototype.afterAll = addHookToTester('afterAll');
Tester.prototype.beforeEach = addHookToTester('beforeEach');
Tester.prototype.afterEach = addHookToTester('afterEach');

export {beforeAll as before, afterAll as after};
export default test;
