import {test, getTests, clearTests, getReporter, setReporter, runTests} from './src/test.js';
import defer from './src/defer.js';
import State from './src/State.js';
import TapReporter from './src/TapReporter.js';

defer(async () => {
  let reporter = getReporter();
  if (!reporter) {
    const tapReporter = new TapReporter({useJson: true});
    reporter = tapReporter.report.bind(tapReporter);
    setReporter(reporter);
  }

  const rootState = new State(null, {callback: reporter});

  rootState.emit({type: 'test', test: 0, time: rootState.timer.now()});
  const tests = getTests();
  await runTests(rootState, tests);
  clearTests();
  rootState.emit({type: 'end', test: 0, time: rootState.timer.now(), fail: rootState.failed > 0, data: rootState});

  if (typeof process == 'object' && typeof process.exit == 'function') {
    process.exit(rootState.failed > 0 ? 1 : 0);
  } else if (typeof __reportTape6Results == 'function') {
    __reportTape6Results(rootState.failed > 0 ? 'failure' : 'success');
  }
});

export default test;
