import process from 'node:process';
import {sep} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Readable, Writable} from 'node:stream';

import {isStopTest} from '../../State.js';
import EventServer from '../../utils/EventServer.js';
import makeDeferred from '../../utils/makeDeferred.js';

import lines from './lines.js';
import parse from './parse-prefixed-jsonl.js';
import wrap from './wrap-lines.js';

const baseName = pathToFileURL(process.cwd() + sep);

const encoder = new TextEncoder();

const runFileArgs = process.versions.bun || process.versions.deno ? ['run'] : [];

export class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks, options) {
    super(reporter, numberOfTasks, options);
    this.counter = 0;
    this.idToWorker = {};
    this.prefix = crypto.randomUUID();
  }
  makeTask(fileName) {
    const self = this;
    const testName = new URL(fileName, baseName),
      id = String(++self.counter),
      worker = spawn(
        process.execPath,
        [...runFileArgs, ...self.options.runFileArgs, fileURLToPath(testName)],
        {
          // stdin is the control channel — see dev-docs/worker-control-channel.md
          stdio: 'pipe',
          env: {
            ...process.env,
            TAPE6_FLAGS: self.options.flags,
            TAPE6_TEST: id,
            TAPE6_TEST_FILE_NAME: fileName,
            TAPE6_JSONL: 'Y',
            TAPE6_JSONL_PREFIX: self.prefix,
            TAPE6_CONTROL: 'Y',
            TAPE6_GRACE_TIMEOUT: String(self.graceTimeout),
            TAPE6_MIN: '',
            TAPE6_TAP: '',
            TAPE6_TTY: ''
          }
        }
      );
    const exited = new Promise((resolve, reject) => {
      worker.on('exit', resolve);
      worker.on('error', reject);
    });
    const task = {worker, started: false, endSeen: false, terminating: false, graceTimer: null};
    self.idToWorker[id] = task;
    const stdoutDeferred = makeDeferred();
    Readable.toWeb(worker.stdout)
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(lines())
      .pipeThrough(parse(self.prefix))
      .pipeTo(
        new WritableStream({
          write(msg) {
            try {
              self.report(id, msg);
            } catch (error) {
              if (!isStopTest(error)) {
                stdoutDeferred.reject(error);
                throw error;
              }
            }
            if (msg && msg.type === 'test') task.started = true;
            // parent-driven exit: the child exits only after its `end` was read —
            // closes the Bun stdout-flush race
            if (msg && msg.type === 'end' && msg.test === 0) {
              task.endSeen = true;
              self.destroyTask(id, 'done');
            }
          },
          close() {
            stdoutDeferred.resolve(undefined);
          }
        })
      );
    const stderrDeferred = makeDeferred();
    Readable.toWeb(worker.stderr)
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(lines())
      .pipeThrough(wrap('stderr'))
      .pipeTo(
        new WritableStream({
          write(msg) {
            self.report(id, msg);
          },
          close() {
            stderrDeferred.resolve(undefined);
          }
        })
      );
    Promise.allSettled([exited, stdoutDeferred.promise, stderrDeferred.promise]).then(() => {
      if (task.graceTimer) {
        clearTimeout(task.graceTimer);
        task.graceTimer = null;
      }
      // before the reports: a stop one of them raises must not arm a kill for a
      // process that is gone, whose timer would hold the run open
      delete self.idToWorker[id];
      // no `end` read — the child crashed or was force-killed while hung
      if (!task.endSeen) {
        // stopped by failOnce or a bail-out: not this file's failure; a deadline
        // is, and the base class reports it
        if (!self.stopRequested && !self.timedOutTasks.has(id)) {
          const reason = [];
          if (worker.exitCode) {
            reason.push(`exit code: ${worker.exitCode}`);
          }
          if (worker.signalCode) {
            reason.push(`signal: ${worker.signalCode}`);
          }
          // a file with no tests also exits 0 without `end`, but it never sends a `test` event
          if (!reason.length && task.started) {
            reason.push('exited mid-test');
          }
          if (reason.length) {
            self.report(id, {
              // State.preprocess defaults a missing type to 'assert'; explicit for the typed TestEvent
              type: 'assert',
              name: 'process has failed, ' + reason.join(', '),
              test: 0,
              marker: new Error(),
              operator: 'error',
              fail: true
            });
          }
        }
        // closes the tests the child left open, or the next file's events nest inside them
        self.report(id, {type: 'terminated', test: 0, name: 'FILE: /' + fileName});
      }
      self.close(id);
    });
    return id;
  }
  // the child drains a running test (cleanup hooks run) and exits on its own;
  // the graceTimeout backstop force-kills one that won't drain
  destroyTask(id, reason = 'done') {
    const task = this.idToWorker[id];
    if (!task || task.terminating) return;
    task.terminating = true;
    this.#sendTerminate(task.worker, reason);
    task.graceTimer = setTimeout(() => this.#kill(id), this.graceTimeout);
  }
  async #sendTerminate(worker, reason) {
    if (!worker.stdin) return;
    try {
      const writer = Writable.toWeb(worker.stdin).getWriter();
      await writer.write(encoder.encode(JSON.stringify({cmd: 'terminate', reason}) + '\n'));
      await writer.close();
    } catch {
      // child already gone / pipe closed
    }
  }
  #kill(id) {
    const task = this.idToWorker[id];
    if (!task) return;
    task.graceTimer = null;
    try {
      task.worker.kill();
    } catch {}
  }
}

export default TestWorker;
