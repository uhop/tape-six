import State, {StopTest} from './State.js';
import Tester from './Tester.js';
import Deferred from './utils/Deferred.js';
import {setTimer} from './timer.js';

let tests = [],
  timerIsSet = false,
  reporter = null,
  testCounter = 0,
  isConfigured = false;

export const getConfiguredFlag = () => isConfigured;
export const setConfiguredFlag = value => (isConfigured = !!value);

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

export const test = async (name, options, testFn) => {
  options = processArgs(name, options, testFn);

  if (!timerIsSet) {
    // set HR timer
    if (typeof window == 'object' && window.performance && typeof window.performance.now == 'function') {
      setTimer(window.performance);
    } else if (typeof process == 'object' && typeof process.exit == 'function') {
      try {
        const {performance} = await import('perf_hooks');
        setTimer(performance);
      } catch (error) {
        setTimer(Date);
      }
    } else {
      setTimer(Date);
    }
    timerIsSet = true;
  }

  const deferred = new Deferred();
  tests.push({options, deferred});
  return deferred.promise;
};

export const getTests = () => tests;
export const clearTests = () => (tests = []);

export const getReporter = () => reporter;
export const setReporter = newReporter => (reporter = newReporter);

export const runTests = async (rootState, tests) => {
  for (let i = 0; i < tests.length; ++i) {
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
          state.emit({type: 'comment', name: 'SKIP test: ' + options.name, test: testNumber, time: state.timer.now()});
        } else {
          options.testFn && (await options.testFn(tester));
        }
      } catch (error) {
        if (!(error instanceof StopTest)) {
          state.emit({
            name: 'UNEXPECTED EXCEPTION: ' + String(error),
            test: testNumber,
            marker: new Error(),
            time: state.timer.now(),
            operator: 'error',
            fail: true,
            data: {
              actual: error
            }
          });
        }
      }
      state.emit({type: 'end', name: options.name, test: testNumber, time: state.timer.now(), fail: state.failed > 0, data: state});
      state.updateParent();
    }
    deferred && deferred.resolve(state);
  }
};

test.skip = async function skip(name, options, testFn) {
  options = processArgs(name, options, testFn);
  return test({...options, skip: true});
};

test.todo = async function todo(name, options, testFn) {
  options = processArgs(name, options, testFn);
  return test({...options, todo: true});
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
  } else {
    await runTests(this.state, [{options: {...options, todo: true}}]);
  }
};

export default test;

// TODO: add option "timeout" for a test
