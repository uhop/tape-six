#!/usr/bin/env node

import cluster from 'cluster';
import os from 'os';
import path from 'path';

import {resolveTests, resolvePatterns} from '../src/node/config.js';

import {
  getTests,
  clearTests,
  getReporter,
  setReporter,
  runTests,
  setConfiguredFlag
} from '../src/test.js';
import State from '../src/State.js';
import TapReporter from '../src/TapReporter.js';
import TestWorker from '../src/node/TestWorker.js';
import {selectTimer} from '../src/utils/timer.js';
import defer from '../src/utils/defer.js';

const options = {},
  rootFolder = process.cwd();

let flags = '',
  parallel = '',
  files = [];

const masterConfiguration = () => {
  const optionNames = {
    f: 'failureOnly',
    t: 'showTime',
    b: 'showBanner',
    d: 'showData',
    o: 'failOnce',
    n: 'showAssertNumber'
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
    } else if (arg == '-p' || arg == '--par') {
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
  if (!parallel) parallel = os.cpus().length;
};

const masterInitialization = async () => {
  let reporter = getReporter();
  if (!reporter) {
    if (process.stdout.isTTY && !process.env.TAPE6_TAP) {
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

const masterProcess = async () => {
  masterConfiguration();
  await masterInitialization();
  await selectTimer();

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

class BufferedReporter {
  constructor() {
    this.buffer = [];
    this.inFlight = false;
    this.shouldExit = false;
  }
  report(event) {
    if (this.inFlight) {
      this.buffer.push(event);
      return this;
    }
    this.buffer.push(event);
    return this.send();
  }
  send() {
    if (!this.buffer.length) {
      this.shouldExit && defer(() => process.exit(0));
      return this;
    }
    this.inFlight = true;
    const events = this.buffer;
    this.buffer = [];
    process.send({events});
    return this;
  }
}

const reporter = new BufferedReporter();

const workerProcess = async () => {
  setReporter(reporter.report.bind(reporter));

  await new Promise((resolve, reject) => {
    process.on('message', async ({id, fileName, options, received, done}) => {
      reporter.inFlight = false;

      if (done) return resolve();

      if (received) {
        if (reporter.buffer.length) {
          reporter.send();
        } else if (reporter.shouldExit) {
          resolve();
        }
        return;
      }

      try {
        let name = path.join(rootFolder, fileName);
        if (!/^file:\/\//.test(name)) {
          if (path.sep === '\\') {
            // windows
            name = 'file://' + path.posix.normalize(name);
          } else {
            name = 'file://' + name;
          }
        }
        await import(name);
      } catch (error) {
        reject(error);
        return;
      }
    });
    process.send({started: true});
  });

  if (reporter.inFlight || reporter.buffer.length) {
    reporter.shouldExit = true;
  } else {
    process.exit(0);
  }
};

const main = async () => {
  if (cluster.isMaster) {
    await masterProcess();
  } else if (cluster.isWorker) {
    await workerProcess();
  }
};
main().catch(error => console.error('ERROR:', error));
