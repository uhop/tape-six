import State from './State.js';
import Tester from './Tester.js';
import TapReporter from './TapReporter.js';
import {getTimer, setTimer} from './timer.js';

let tests = 0;
let timerIsSet = false;

const buildCallback = callback => {
  if (callback) return callback;
  const reporter = new TapReporter({useJson: true});
  return reporter.report.bind(reporter);
};

const test = async (name, options, testFn) => {
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

  if (!timerIsSet) {
    // set HR timer
    if (typeof window != 'undefined' && window.performance && typeof window.performance.now == 'function') {
      setTimer(window.performance);
    } else {
      setTimer(await import('perf_hooks').then(module => module.performance, () => Date));
    }
    timerIsSet = true;
  }
  const timer = getTimer();

  // run tests
  const testId = ++tests,
    state = new State(buildCallback(options.callback)),
    tester = new Tester(state, tests);
  try {
    state.emit({type: 'test', name: options.name, test: testId, time: state.time});
    await options.testFn(tester);
  } catch (error) {
    state.emit({
      name: 'unexpected exception: ' + String(error),
      test: testId,
      marker: new Error(),
      time: timer.now(),
      operator: 'error',
      fail: true,
      data: {
        actual: error
      }
    });
    throw error;
  } finally {
    state.emit({type: 'end', name: options.name, test: testId, time: timer.now(), fail: state.failed > 0, data: state});
  }
};

export default test;
