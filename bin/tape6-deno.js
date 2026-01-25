#!/usr/bin/env -S deno run --allow-all --ext=js

import {fileURLToPath} from 'node:url';

import {
  resolveTests,
  resolvePatterns,
  getReporter as getReporterType
} from '../src/utils/config.js';

import {getReporter, setReporter} from '../src/test.js';
import State, {StopTest} from '../src/State.js';
import {selectTimer} from '../src/utils/timer.js';

import TestWorker from '../src/deno/TestWorker.js';

const options = {},
  rootFolder = Deno.cwd();

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
  Deno.exit(0);
};

const config = () => {
  if (Deno.args.includes('--self')) showSelf();

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

  for (let i = 0; i < Deno.args.length; ++i) {
    const arg = Deno.args[i];
    if (arg == '-f' || arg == '--flags') {
      if (++i < Deno.args.length) {
        flags = Deno.args[i];
      }
      continue;
    }
    if (arg == '-p' || arg == '--par') {
      if (++i < Deno.args.length) {
        parallel = Deno.args[i];
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

  flags = (Deno.env.get('TAPE6_FLAGS') || '') + flags;
  for (let i = 0; i < flags.length; ++i) {
    const option = flags[i].toLowerCase(),
      name = optionNames[option];
    if (typeof name == 'string') options[name] = option !== flags[i];
  }
  options.flags = flags;

  if (!parIsSet) {
    parallel = Deno.env.get('TAPE6_PAR') || parallel;
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
      CustomReporter = (await import('../src/' + reporterFile)).default,
      customOptions =
        reporterType === 'tap' ? {useJson: true, hasColors: !options.monochrome} : options,
      customReporter = new CustomReporter(customOptions);
    setReporter(customReporter.report.bind(customReporter));
  }

  if (files.length) {
    files = await resolvePatterns(rootFolder, files);
  } else {
    files = await resolveTests(rootFolder, 'deno');
  }
};

const safeEmit = rootState => event => {
  try {
    rootState.emit(event);
  } catch (error) {
    if (!(error instanceof StopTest)) throw error;
  }
};

const main = async () => {
  config();
  await init();
  await selectTimer();

  addEventListener('error', event => {
    console.log('UNHANDLED ERROR:', event.message);
    event.preventDefault();
  });

  const rootState = new State(null, {callback: getReporter(), failOnce: options.failOnce}),
    worker = new TestWorker(safeEmit(rootState), parallel, options);

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

  Deno.exit(rootState.failed > 0 ? 1 : 0);
};

main().catch(error => console.error('ERROR:', error));
