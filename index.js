// @ts-self-types="./index.d.ts"

import {
  test,
  getTests,
  clearTests,
  getReporter,
  setReporter,
  runTests,
  getConfiguredFlag,
  registerNotifyCallback
} from './src/test.js';
import {selectTimer} from './src/utils/timer.js';
import defer from './src/utils/defer.js';
import TapReporter from './src/reporters/TapReporter.js';

const optionNames = {
  f: 'failureOnly',
  t: 'showTime',
  b: 'showBanner',
  d: 'showData',
  o: 'failOnce',
  n: 'showAssertNumber',
  m: 'monochrome',
  j: 'useJsonL',
  c: 'dontCaptureConsole',
  h: 'hideStreams'
};

const init = async () => {
  const isNode = typeof process == 'object' && process.versions?.node,
    isDeno = typeof Deno == 'object',
    isBun = typeof Bun == 'object',
    isBrowser = typeof window == 'object' && !!window.location,
    options = {};

  let flags = '';

  if (isBrowser) {
    if (typeof window.__tape6_flags == 'string') {
      flags = window.__tape6_flags;
    } else if (window.location.search) {
      flags = new URLSearchParams(window.location.search.substring(1)).get('flags') || '';
    }
  } else if (isDeno) {
    flags = Deno.env.get('TAPE6_FLAGS') || '';
  } else if (isBun) {
    flags = Bun.env.TAPE6_FLAGS || '';
  } else if (isNode) {
    flags = process.env.TAPE6_FLAGS || '';
  }

  for (let i = 0; i < flags.length; ++i) {
    const option = flags[i].toLowerCase(),
      name = optionNames[option];
    if (typeof name == 'string') options[name] = option !== flags[i];
  }
  options.flags = flags;

  let originalConsole = null;
  if (!options.dontCaptureConsole && (isNode || isBun || isDeno)) {
    const {captureConsole} = await import(
      new URL('./src/utils/capture-console.js', import.meta.url)
    );
    originalConsole = captureConsole();
  }

  let reporter = getReporter();
  if (!reporter) {
    if (isBrowser) {
      const id =
        window.__tape6_id || new URLSearchParams(window.location.search.substring(1)).get('id');
      if (typeof window.__tape6_reporter == 'function') {
        const reportTo = event => window.__tape6_reporter(id, event),
          {ProxyReporter} = await import('./src/reporters/ProxyReporter.js');
        reporter = new ProxyReporter({...options, reportTo});
      } else if (window.parent && typeof window.parent.__tape6_reporter == 'function') {
        const reportTo = event => window.parent.__tape6_reporter(id, event),
          {ProxyReporter} = await import('./src/reporters/ProxyReporter.js');
        reporter = new ProxyReporter({...options, reportTo});
      } else if (options.useJsonL) {
        const {JSONLReporter} = await import('./src/reporters/JSONLReporter.js');
        reporter = new JSONLReporter({...options, originalConsole});
      }
    } else if (isDeno) {
      if (Deno.env.get('TAPE6_JSONL')) {
        const {JSONLReporter} = await import('./src/reporters/JSONLReporter.js');
        reporter = new JSONLReporter({...options, originalConsole});
      } else if (!Deno.env.get('TAPE6_TAP')) {
        const {TTYReporter} = await import('./src/reporters/TTYReporter.js');
        reporter = new TTYReporter({...options, originalConsole});
      }
    } else if (isBun) {
      if (Bun.env.TAPE6_JSONL) {
        const {JSONLReporter} = await import('./src/reporters/JSONLReporter.js');
        reporter = new JSONLReporter({...options, originalConsole});
      } else if (!Bun.env.TAPE6_TAP) {
        const {TTYReporter} = await import('./src/reporters/TTYReporter.js');
        reporter = new TTYReporter({...options, originalConsole});
      }
    } else if (isNode) {
      if (process.env.TAPE6_JSONL) {
        const {JSONLReporter} = await import('./src/reporters/JSONLReporter.js');
        reporter = new JSONLReporter({...options, originalConsole});
      } else if (!process.env.TAPE6_TAP) {
        const {TTYReporter} = await import('./src/reporters/TTYReporter.js');
        reporter = new TTYReporter({...options, originalConsole});
      }
    }
    reporter ||= new TapReporter({
      useJson: true,
      hasColors: !options.monochrome,
      originalConsole
    });
    setReporter(reporter);
  }

  let testFileName = '';

  if (isBrowser) {
    if (typeof window.__tape6_test_file_name == 'string') {
      testFileName = window.__tape6_test_file_name;
    } else if (window.location.search) {
      testFileName =
        new URLSearchParams(window.location.search.substring(1)).get('test-file-name') || '';
    }
  } else if (isDeno) {
    testFileName = Deno.env.get('TAPE6_TEST_FILE_NAME') || '';
  } else if (isBun) {
    testFileName = Bun.env.TAPE6_TEST_FILE_NAME || '';
  } else if (isNode) {
    testFileName = process.env.TAPE6_TEST_FILE_NAME || '';
  }

  return {reporter, options, testFileName};
};

let settings = null;

const testCallback = async () => {
  await selectTimer();
  if (!settings) settings = await init();

  const {reporter, testFileName} = settings;

  reporter.report({
    type: 'test',
    test: 0,
    name: testFileName ? 'FILE: /' + testFileName : ''
  });

  for (;;) {
    const tests = getTests();
    if (!tests.length) break;
    clearTests();
    const canContinue = await runTests(tests);
    if (!canContinue) break;
    await new Promise(resolve => defer(resolve));
  }

  const runHasFailed = reporter.state && reporter.state.failed > 0;

  reporter.report({
    type: 'end',
    test: 0,
    name: testFileName ? 'FILE: /' + testFileName : '',
    fail: runHasFailed
  });

  if (typeof Deno == 'object') {
    runHasFailed && Deno.exit(1);
  } else if (typeof Bun == 'object') {
    runHasFailed && process.exit(1);
  } else if (typeof process == 'object' && process.versions?.node) {
    runHasFailed && process.exit(1);
  } else if (typeof __tape6_reportResults == 'function') {
    __tape6_reportResults(runHasFailed ? 'failure' : 'success');
  }

  registerNotifyCallback(testCallback); // register self again
};

if (!getConfiguredFlag()) {
  // if nobody is running the show
  registerNotifyCallback(testCallback);
}

export {test};
export default test;
