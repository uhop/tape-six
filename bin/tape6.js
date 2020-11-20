#!/usr/bin/env node

import {promises as fsp} from 'fs';
import path from 'path';

import {resolveTests, resolvePatterns} from '../src/node/config.js';

import {test, getTests, clearTests, getReporter, setReporter, runTests, setConfiguredFlag} from '../src/test.js';
import defer from '../src/utils/defer.js';
import State from '../src/State.js';
import TapReporter from '../src/TapReporter.js';

setConfiguredFlag(true); // we are running the show

const optionNames = {f: 'failureOnly', t: 'showTime', b: 'showBanner', d: 'showData', o: 'failOnce'},
  options = {};

let flags = '', flagIsSet = false, files = [];

for (let i = 2; i < process.argv.length; ++i) {
  const arg = process.argv[i];
  if (arg == '-f' || arg == '--flags') {
    if (++i < process.argv.length) {
      flags = process.argv[i];
      flagIsSet = true;
    }
    break;
  }
  files.push(arg);
}

const init = async () => {
  let reporter = getReporter();
  if (!reporter) {
    if (process.stdout.isTTY) {
      const TTYReporter = (await import('../src/TTYReporter.js')).default;
      if (!process.env.TAPE6_TAP) {
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

  if (!flagIsSet) {
    flags = process.env.TAPE6_FLAGS || flags;
  }

  for (let i = 0; i < flags.length; ++i) {
    const option = flags[i].toLowerCase(),
      name = optionNames[option];
    if (typeof name == 'string') options[name] = option !== flags[i];
  }

  const rootFolder = process.cwd();
  if (files.length) {
    files = await resolvePatterns(rootFolder, files);
  } else {
    files = await resolveTests(rootFolder, 'node');
  }
};

const main = async () => {
  await init();

  console.log('ARGV:', process.argv.length);
  console.log('TEST FILES:', files.length);
  files.forEach(name => console.log(' ', name));

  // const rootState = new State(null, {callback: reporter, failOnce: options.failOnce});

  // rootState.emit({type: 'test', test: 0, time: rootState.timer.now()});
  // for (;;) {
  //   const tests = getTests();
  //   if (!tests.length) break;
  //   clearTests();
  //   await runTests(rootState, tests);
  // }
  // rootState.emit({type: 'end', test: 0, time: rootState.timer.now(), fail: rootState.failed > 0, data: rootState});

  // process.exit(rootState.failed > 0 ? 1 : 0);
};
main().then(() => console.log('Done.'), error => console.error('ERROR:', error));
