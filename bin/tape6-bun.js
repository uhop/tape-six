#!/usr/bin/env bun

import {fileURLToPath} from 'node:url';

import {getOptions, initFiles, initReporter} from '../src/utils/config.js';

import {getReporter, setReporter} from '../src/test.js';
import {selectTimer} from '../src/utils/timer.js';

import TestWorker from '../src/runners/bun/TestWorker.js';

const rootFolder = Bun.cwd;

const showSelf = () => {
  const self = new URL(import.meta.url);
  if (self.protocol === 'file:') {
    console.log(fileURLToPath(self));
  } else {
    console.log(self);
  }
  process.exit(0);
};

const main = async () => {
  const currentOptions = getOptions({
    '--self': showSelf
  });

  const [files] = await Promise.all([
    initFiles(currentOptions.files, rootFolder),
    initReporter(getReporter, setReporter, currentOptions.flags),
    selectTimer()
  ]);

  process.on('uncaughtException', (error, origin) => {
    console.error('UNHANDLED ERROR:', origin, error);
    process.exit(1);
  });

  if (!files.length) {
    console.log('No files found.');
    process.exit(1);
  }

  const reporter = getReporter(),
    worker = new TestWorker(reporter, currentOptions.parallel, currentOptions.flags);

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
