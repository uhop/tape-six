#!/usr/bin/env node

import process from 'node:process';

import {fileURLToPath} from 'node:url';

import {resolveTests, resolvePatterns} from '../src/utils/config.js';

import {getReporter, setReporter} from '../src/test.js';
import State from '../src/State.js';
import TapReporter from '../src/TapReporter.js';
import {selectTimer} from '../src/utils/timer.js';

import TestWorker from '../src/node/TestWorker.js';

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
    c: 'hasColors'
  };

  let flagIsSet = false,
    parIsSet = false;

  for (let i = 2; i < process.argv.length; ++i) {
    const arg = process.argv[i];
    if (arg == '-f' || arg == '--flags') {
      if (++i < process.argv.length) {
        flags = process.argv[i];
        flagIsSet = true;
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

  if (!flagIsSet) {
    flags = process.env.TAPE6_FLAGS || flags;
  }
  for (let i = 0; i < flags.length; ++i) {
    const option = flags[i].toLowerCase(),
      name = optionNames[option];
    if (typeof name == 'string') options[name] = option !== flags[i];
  }

  if (!parIsSet) {
    parallel = process.env.TAPE6_PAR || parallel;
  }
  if (parallel) {
    parallel = Math.max(0, +parallel);
    if (parallel === Infinity) parallel = 0;
  } else {
    parallel = 0;
  }
  if (!parallel) parallel = navigator.hardwareConcurrency;
};

const init = async () => {
  let reporter = getReporter();
  if (!reporter) {
    if (!process.env.TAPE6_TAP) {
      const TTYReporter = (await import('../src/TTYReporter.js')).default,
        ttyReporter = new TTYReporter(options);
      ttyReporter.testCounter = -2;
      ttyReporter.technicalDepth = 1;
      reporter = ttyReporter.report.bind(ttyReporter);
    }
    if (!reporter) {
      const tapReporter = new TapReporter({useJson: true});
      reporter = tapReporter.report.bind(tapReporter);
    }
    setReporter(reporter);
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

  process.on('uncaughtException', (error, origin) => console.error('UNHANDLED ERROR:', origin,error));

  const rootState = new State(null, {callback: getReporter(), failOnce: options.failOnce}),
    worker = new TestWorker(event => rootState.emit(event), parallel, options);

  rootState.emit({type: 'test', test: 0, time: rootState.timer.now()});

  await new Promise(resolve => {
    worker.done = () => resolve();
    worker.execute(files);
  });

  rootState.emit({
    type: 'end',
    test: 0,
    time: rootState.timer.now(),
    fail: rootState.failed > 0,
    data: rootState
  });

  process.exit(rootState.failed > 0 ? 1 : 0);
};

main().catch(error => console.error('ERROR:', error));
