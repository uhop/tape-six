import {test, getTests, clearTests, getReporter, setReporter, runTests, getConfiguredFlag} from './src/test.js';
import defer from './src/utils/defer.js';
import State from './src/State.js';
import TapReporter from './src/TapReporter.js';

const optionNames = {f: 'failureOnly', t: 'showTime', b: 'showBanner', d: 'showData', o: 'failOnce', n: 'showAssertNumber'};

defer(async () => {
  if (getConfiguredFlag()) return; // bail out => somebody else is running the show

  const isNode = typeof process == 'object' && typeof process.exit == 'function',
    isDeno = typeof Deno == 'object' && typeof Deno.exit == 'function',
    isBun = typeof Bun == 'object',
    isBrowser = typeof window == 'object' && !!window.location,
    options = {};

  let flags = '';

  if (isBrowser) {
    if (typeof window.__tape6_flags == 'string') {
      flags = window.__tape6_flags;
    } else if (window.location.search) {
      flags = (new URLSearchParams(window.location.search.substring(1))).get('flags') || '';
    }
  } else if (isNode) {
    flags = process.env.TAPE6_FLAGS || '';
  } else if (isDeno) {
    flags = Deno.env.get('TAPE6_FLAGS') || '';
  } else if (isBun) {
    flags = Bun.env.TAPE6_FLAGS || '';
  }

  for (let i = 0; i < flags.length; ++i) {
    const option = flags[i].toLowerCase(),
      name = optionNames[option];
    if (typeof name == 'string') options[name] = option !== flags[i];
  }

  let reporter = getReporter();
  if (!reporter) {
    if (isBrowser) {
      const id = window.__tape6_id || (new URLSearchParams(window.location.search.substring(1))).get('id');
      if (typeof window.__tape6_reporter == 'function') {
        reporter = event => window.__tape6_reporter(id, event);
      } else if (window.parent && typeof window.parent.__tape6_reporter == 'function') {
        reporter = event => window.parent.__tape6_reporter(id, event);
      }
    } else if (isNode) {
      if (!process.env.TAPE6_TAP) {
        const TTYReporter = (await import('./src/TTYReporter.js')).default,
          ttyReporter = new TTYReporter(options);
        reporter = ttyReporter.report.bind(ttyReporter);
      }
    } else if (isDeno) {
      if (!Deno.env.get('TAPE6_TAP')) {
        const TTYReporter = (await import('./src/TTYReporter.js')).default,
          ttyReporter = new TTYReporter(options);
        reporter = ttyReporter.report.bind(ttyReporter);
      }
    } else if (isBun) {
      if (!Bun.env.TAPE6_TAP) {
        const TTYReporter = (await import('./src/TTYReporter.js')).default,
          ttyReporter = new TTYReporter(options);
        reporter = ttyReporter.report.bind(ttyReporter);
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
    await new Promise(resolve => defer(resolve));
  }
  rootState.emit({type: 'end', test: 0, time: rootState.timer.now(), fail: rootState.failed > 0, data: rootState});

  if (isNode) {
    !process.env.TAPE6_WORKER && process.exit(rootState.failed > 0 ? 1 : 0);
  } else if (isDeno) {
    !Deno.env.get('TAPE6_WORKER') && Deno.exit(rootState.failed > 0 ? 1 : 0);
  } else if (isBun) {
    !Bun.env.TAPE6_WORKER && process.exit(rootState.failed > 0 ? 1 : 0);
  } else if (typeof __tape6_reportResults == 'function') {
    __tape6_reportResults(rootState.failed > 0 ? 'failure' : 'success');
  }
});

export default test;
