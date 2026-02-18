#!/usr/bin/env bun

import {fileURLToPath} from 'node:url';

import {
  resolveTests,
  resolvePatterns,
  getReporterFileName,
  getReporterType
} from '../src/utils/config.js';

import {getReporter, setReporter} from '../src/test.js';
import {selectTimer} from '../src/utils/timer.js';

import TestWorker from '../src/runners/bun/TestWorker.js';

const options = {},
  rootFolder = Bun.cwd;

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
  if (Bun.argv.includes('--self')) showSelf();

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

  for (let i = 2; i < Bun.argv.length; ++i) {
    const arg = Bun.argv[i];
    if (arg == '-f' || arg == '--flags') {
      if (++i < Bun.argv.length) {
        flags += Bun.argv[i];
      }
      continue;
    }
    if (arg == '-p' || arg == '--par') {
      if (++i < Bun.argv.length) {
        parallel = Bun.argv[i];
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

  flags = (Bun.env.TAPE6_FLAGS || '') + flags;
  for (let i = 0; i < flags.length; ++i) {
    const option = flags[i].toLowerCase(),
      name = optionNames[option];
    if (typeof name == 'string') options[name] = option !== flags[i];
  }
  options.flags = flags;

  if (!parIsSet) {
    parallel = Bun.env.TAPE6_PAR || parallel;
  }
  if (parallel) {
    parallel = Math.max(0, +parallel);
    if (parallel === Infinity) parallel = 0;
  } else {
    parallel = 0;
  }
  if (!parallel) parallel = globalThis.navigator?.hardwareConcurrency || 1;
};

const init = async () => {
  const currentReporter = getReporter();
  if (!currentReporter) {
    const reporterType = getReporterType(),
      reporterFile = getReporterFileName(reporterType),
      CustomReporter = (await import('../src/reporters/' + reporterFile)).default,
      hasColors = !(
        options.monochrome ||
        Bun.env.NO_COLOR ||
        Bun.env.NODE_DISABLE_COLORS ||
        Bun.env.FORCE_COLOR === '0'
      ),
      customOptions = reporterType === 'tap' ? {useJson: true, hasColors} : {...options, hasColors},
      customReporter = new CustomReporter(customOptions);
    setReporter(customReporter);
  }

  if (files.length) {
    files = await resolvePatterns(rootFolder, files);
  } else {
    files = await resolveTests(rootFolder, 'bun');
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
