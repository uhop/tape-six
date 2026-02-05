#!/usr/bin/env node

import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {resolveTests, resolvePatterns, getReporterType} from '../src/utils/config.js';

import {getReporter, setReporter} from '../src/test.js';
import {selectTimer} from '../src/utils/timer.js';

import TestWorker from '../src/runners/node/TestWorker.js';

const options = {},
  rootFolder = process.cwd();

let flags = '',
  parallel = '',
  files = [];

const showSelf = () => {
  const self = new URL(import.meta.url);
  if (self.protocol === 'file:') {
    console.log(fileURLToPath(self));
  } else {
    console.log(self);
  }
  process.exit(0);
};

const config = () => {
  if (process.argv.includes('--self')) showSelf();

  const optionNames = {
    f: 'failureOnly',
    t: 'showTime',
    b: 'showBanner',
    d: 'showData',
    o: 'failOnce',
    n: 'showAssertNumber',
    m: 'monochrome',
    c: 'dontCaptureConsole',
    h: 'hideStreams'
  };

  let parIsSet = false;

  for (let i = 2; i < process.argv.length; ++i) {
    const arg = process.argv[i];
    if (arg == '-f' || arg == '--flags') {
      if (++i < process.argv.length) {
        flags += process.argv[i];
      }
      continue;
    }
    if (arg == '-p' || arg == '--par') {
      if (++i < process.argv.length) {
        parallel = process.argv[i];
        parIsSet = true;
        if (!parallel || isNaN(parallel)) {
          parallel = '';
          parIsSet = false;
        }
      }
      continue;
    }
    files.push(arg);
  }

  flags = (process.env.TAPE6_FLAGS || '') + flags;
  for (let i = 0; i < flags.length; ++i) {
    const option = flags[i].toLowerCase(),
      name = optionNames[option];
    if (typeof name == 'string') options[name] = option !== flags[i];
  }
  options.flags = flags;

  if (!parIsSet) {
    parallel = process.env.TAPE6_PAR || parallel;
  }
  if (parallel) {
    parallel = Math.max(0, +parallel);
    if (parallel === Infinity) parallel = 0;
  } else {
    parallel = 0;
  }
  if (!parallel) parallel = globalThis.navigator?.hardwareConcurrency || 1;
};

const reporters = {
  jsonl: 'JSONLReporter.js',
  tap: 'TapReporter.js',
  tty: 'TTYReporter.js'
};

const init = async () => {
  const currentReporter = getReporter();
  if (!currentReporter) {
    const reporterType = getReporterType(),
      reporterFile = reporters[reporterType] || reporters.tty,
      CustomReporter = (await import('../src/reporters/' + reporterFile)).default,
      hasColors = !(
        options.monochrome ||
        process.env.NO_COLOR ||
        process.env.NODE_DISABLE_COLORS ||
        process.env.FORCE_COLOR === '0'
      ),
      customOptions = reporterType === 'tap' ? {useJson: true, hasColors} : {...options, hasColors},
      customReporter = new CustomReporter(customOptions);
    setReporter(customReporter);
  }

  if (files.length) {
    files = await resolvePatterns(rootFolder, files);
  } else {
    files = await resolveTests(rootFolder, 'node');
  }
};

const main = async () => {
  config();
  await init();
  await selectTimer();

  process.on('uncaughtException', (error, origin) =>
    console.error('UNHANDLED ERROR:', origin, error)
  );

  const reporter = getReporter(),
    worker = new TestWorker(reporter, parallel, options);

  reporter.report({type: 'test', test: 0});

  await new Promise(resolve => {
    worker.done = () => resolve();
    worker.execute(files);
  });

  const hasFailed = reporter.state && reporter.state.failed > 0;

  reporter.report({
    type: 'end',
    test: 0,
    fail: hasFailed
  });

  process.exit(hasFailed ? 1 : 0);
};

main().catch(error => console.error('ERROR:', error));
