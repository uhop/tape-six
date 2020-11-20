#!/usr/bin/env node

import {promises as fsp} from 'fs';
import path from 'path';

import {union, exclude} from '../src/utils/fileSets.js';
import {listing, wildToRe} from '../src/node/listing.js';

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

if (!flagIsSet && !files.length) {
  console.log('Help');
  process.exit(1);
}

if (files.includes('@') && files.length != 1) {
  console.log('Error: @');
  process.exit(1);
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

  if (files.length == 1 && files[0] == '@') {
    try {
      const pkg = JSON.parse(await fsp.readFile(path.join(process.cwd(), 'package.json')));
      files = pkg.tape6 && Array.isArray(pkg.tape6.tests) && pkg.tape6.tests || [];
      if(!flagIsSet) {
        flags = pkg.tape6 && typeof pkg.tape6.flags == 'string' && typeof pkg.tape6.flags || '';
      }
    } catch (error) {
      console.log('Error: cannot read and parse package.json in the current directory.');
      process.exit(1);
    }
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
  let result = [];
  for (const item of files) {
    if (item.length && item[0] == '!') {
      result = exclude(result, wildToRe(rootFolder, item.substr(1)));
    } else {
      result = union(result, await listing(rootFolder, item));
    }
  }
  files = result;
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
