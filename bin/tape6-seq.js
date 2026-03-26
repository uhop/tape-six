#!/usr/bin/env node

import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {
  getOptions,
  initFiles,
  initReporter,
  showInfo,
  printVersion,
  printHelp,
  printFlagOptions
} from '../src/utils/config.js';

import {getReporter, setReporter, setConfiguredFlag, testRunner} from '../src/test.js';
import {selectTimer} from '../src/utils/timer.js';

import TestWorker from '../src/runners/seq/TestWorker.js';

setConfiguredFlag(true);

const rootFolder = process.cwd();

const showSelf = () => {
  const self = new URL(import.meta.url);
  if (self.protocol === 'file:') {
    console.log(fileURLToPath(self));
  } else {
    console.log(self);
  }
  process.exit(0);
};

const showVersion = () => {
  printVersion('tape6-seq');
  process.exit(0);
};

const showHelp = () => {
  printHelp(
    'tape6-seq',
    'Tape6 test runner (sequential, in-process)',
    'tape6-seq [options] [files...]',
    [
      ['--flags, -f <flags>', 'Set reporter flags (env: TAPE6_FLAGS)'],
      ['--par, -p <n>', 'Set parallelism level (env: TAPE6_PAR)'],
      ['--info', 'Show configuration info and exit'],
      ['--self', 'Print the path to this script and exit'],
      ['--help, -h', 'Show this help message and exit'],
      ['--version, -v', 'Show version and exit']
    ]
  );
  printFlagOptions();
  process.exit(0);
};

const main = async () => {
  const currentOptions = getOptions({
    '--self': {fn: showSelf, isValueRequired: false},
    '--info': {isValueRequired: false},
    '--help': {aliases: ['-h'], fn: showHelp, isValueRequired: false},
    '--version': {aliases: ['-v'], fn: showVersion, isValueRequired: false}
  });

  const [files] = await Promise.all([
    initFiles(currentOptions.files, rootFolder),
    initReporter(getReporter, setReporter, currentOptions.flags),
    selectTimer()
  ]);

  const console = globalThis.console;

  process.on('uncaughtException', (error, origin) => {
    console.error('UNHANDLED ERROR:', origin, error);
    process.exit(1);
  });

  if (currentOptions.optionFlags['--info'] === '') {
    showInfo(currentOptions, files);
    await new Promise(r => process.stdout.write('', r));
    process.exitCode = 0;
    return;
  }

  if (!files.length) {
    console.log('No files found.');
    await new Promise(r => process.stdout.write('', r));
    process.exitCode = 1;
    return;
  }

  const reporter = getReporter(),
    worker = new TestWorker(reporter, 1, {...currentOptions.flags, testRunner});

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

  await new Promise(r => process.stdout.write('', r));
  process.exitCode = hasFailed ? 1 : 0;
};

main().catch(error => console.error('ERROR:', error));
