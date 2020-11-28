import {test, getTests, clearTests, getReporter, setReporter, runTests, getConfiguredFlag} from './src/test.js';
import defer from './src/utils/defer.js';
import State from './src/State.js';
import TapReporter from './src/TapReporter.js';

const optionNames = {f: 'failureOnly', t: 'showTime', b: 'showBanner', d: 'showData', o: 'failOnce'};

defer(async () => {
  if (getConfiguredFlag()) return; // bail out => somebody else is running the show

  const isNode = typeof process == 'object' && typeof process.exit == 'function',
    isBrowser = typeof window == 'object' && !!window.location,
    options = {};

  let flags = '';

  if (isNode) {
    flags = process.env.TAPE6_FLAGS || '';
  } else if (isBrowser) {
    if (typeof window.__tape6_flags == 'string') {
      flags = window.__tape6_flags;
    } else if (window.location.search) {
      flags = (new URLSearchParams(window.location.search.substr(1))).get('flags') || '';
    }
  }

  for (let i = 0; i < flags.length; ++i) {
    const option = flags[i].toLowerCase(),
      name = optionNames[option];
    if (typeof name == 'string') options[name] = option !== flags[i];
  }

  let reporter = getReporter();
  if (!reporter) {
    if (isNode && process.stdout.isTTY) {
      const TTYReporter = (await import('./src/TTYReporter.js')).default;
      if (!process.env.TAPE6_TAP) {
        const ttyReporter = new TTYReporter(options);
        reporter = ttyReporter.report.bind(ttyReporter);
      }
    }
    if (isBrowser) {
      const id = window.__tape6_id || (new URLSearchParams(window.location.search.substr(1))).get('id');
      if (typeof window.__tape6_reporter == 'function') {
        reporter = event => window.__tape6_reporter(id, event);
      } else if (window.parent && typeof window.parent.__tape6_reporter == 'function') {
        reporter = event => window.parent.__tape6_reporter(id, event);
      }
    }
    if (!reporter) {
      const tapReporter = new TapReporter({useJson: true});
      reporter = tapReporter.report.bind(tapReporter);
    }
    setReporter(reporter);
  }

  const rootState = new State(null, {callback: reporter, failOnce: options.failOnce});

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
