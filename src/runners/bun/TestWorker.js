import {sep} from 'node:path';

import EventServer from '../../utils/EventServer.js';

const srcName = new URL('../../', import.meta.url),
  baseName = Bun.pathToFileURL(Bun.cwd + sep);

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
    worker.addEventListener('message', event => {
      const msg = event.data;
      this.report(id, msg);
      if (msg.type === 'end' && msg.test === 0) {
        this.close(id);
      }
    });
    worker.addEventListener('error', error => {
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
    worker.addEventListener('messageerror', error => {
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
      this.#kill(id);
      return;
    }
    // force-kill backstop: the test may ignore the abort signal and never settle
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
