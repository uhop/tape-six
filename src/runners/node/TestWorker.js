import process from 'node:process';
import {sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';

import EventServer from '../../utils/EventServer.js';

const srcName = new URL('../../', import.meta.url),
  baseName = pathToFileURL(process.cwd() + sep);

export class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks = globalThis.navigator?.hardwareConcurrency || 1, options) {
    super(reporter, numberOfTasks, options);
    this.counter = 0;
    this.idToWorker = {};
    this.graceTimers = {};
  }
  makeTask(fileName) {
    const testName = new URL(fileName, baseName),
      id = String(++this.counter),
      worker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });
    this.idToWorker[id] = worker;
    worker.on('message', msg => {
      this.report(id, msg);
      if (msg.type === 'end' && msg.test === 0) {
        this.close(id);
      }
    });
    worker.on('error', error => {
      this.report(id, {
        type: 'comment',
        name: 'fail to load: ' + (error.message || 'Worker error'),
        test: 0
      });
      this.report(id, {
        name: String(error),
        test: 0,
        marker: new Error(),
        operator: 'error',
        fail: true,
        data: {
          actual: error
        }
      });
      this.close(id);
    });
    worker.on('messageerror', error => {
      this.report(id, {
        type: 'comment',
        name: 'fail to load: ' + (error.message || 'Worker error'),
        test: 0
      });
      this.report(id, {
        name: String(error),
        test: 0,
        marker: new Error(),
        operator: 'error',
        fail: true,
        data: {
          actual: error
        }
      });
      this.close(id);
    });
    worker.postMessage({
      fileName,
      testName: testName.href,
      srcName: srcName.href,
      options: this.options
    });
    return id;
  }
  destroyTask(id, reason = 'done') {
    const worker = this.idToWorker[id];
    if (!worker) return;
    if (reason === 'done') {
      // The test already finished; worker_threads have no flush race, so just
      // tear the worker down.
      this.#kill(id);
      return;
    }
    // Cooperative drain (abort): ask the child to fire its abort signal and run
    // cleanup hooks, then force-kill as a backstop after graceTimeout in case
    // the test ignores the signal and never settles.
    if (this.graceTimers[id]) return; // already draining
    try {
      worker.postMessage({type: 'terminate', reason});
    } catch (e) {
      void e;
    }
    this.graceTimers[id] = setTimeout(() => this.#kill(id), this.graceTimeout);
  }
  #kill(id) {
    const grace = this.graceTimers[id];
    if (grace) {
      clearTimeout(grace);
      delete this.graceTimers[id];
    }
    const worker = this.idToWorker[id];
    if (worker) {
      worker.terminate();
      delete this.idToWorker[id];
    }
  }
}

export default TestWorker;
