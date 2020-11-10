import {test, getTests, clearTests, getReporter, setReporter, runTests, getConfiguredFlag} from './src/test.js';
import defer from './src/defer.js';
import State from './src/State.js';
import TapReporter from './src/TapReporter.js';

defer(async () => {
  if (getConfiguredFlag()) return; // bail out => somebody else is running the show

  const isNode = typeof process == 'object' && typeof process.exit == 'function';

  let reporter = getReporter();
  if (!reporter) {
    if (isNode && process.stdout.isTTY) {
      const TTYReporter = (await import('./src/TTYReporter.js')).default;
      if (!process.env.TAPE6_TAP) {
        const options = {};
        if (process.env.TAPE6_FLAGS) {
          const flags = process.env.TAPE6_FLAGS;
          for (let i = 0; i < flags.length; ++i) {
            switch (flags[i].toLowerCase()) {
              case 'f':
                options.failureOnly = flags[i] === 'F';
                break;
              case 't':
                options.showTime = flags[i] === 'T';
                break;
              case 'b':
                options.showBanner = flags[i] === 'B';
                break;
              case 'd':
                options.showData = flags[i] === 'D';
                break;
            }
          }
        }
        const ttyReporter = new TTYReporter(options);
        reporter = ttyReporter.report.bind(ttyReporter);
      }
    }
    if (!reporter) {
      const tapReporter = new TapReporter({useJson: true});
      reporter = tapReporter.report.bind(tapReporter);
    }
    setReporter(reporter);
  }

  const rootState = new State(null, {callback: reporter});

  rootState.emit({type: 'test', test: 0, time: rootState.timer.now()});
  for (;;) {
    const tests = getTests();
    if (!tests.length) break;
    clearTests();
    await runTests(rootState, tests);
  }
  rootState.emit({type: 'end', test: 0, time: rootState.timer.now(), fail: rootState.failed > 0, data: rootState});

  if (isNode) {
    process.exit(rootState.failed > 0 ? 1 : 0);
  } else if (typeof __reportTape6Results == 'function') {
    __reportTape6Results(rootState.failed > 0 ? 'failure' : 'success');
  }
});

export default test;
