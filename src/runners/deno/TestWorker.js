import {pathToFileURL} from 'node:url';
import {sep} from 'node:path';

import EventServer from '../../utils/EventServer.js';

const srcName = new URL('../../', import.meta.url),
  baseName = pathToFileURL(Deno.cwd() + sep);

export default class TestWorker extends EventServer {
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
        // deno: {permissions: 'inherit'}
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
      // The test already finished; just tear the worker down.
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
