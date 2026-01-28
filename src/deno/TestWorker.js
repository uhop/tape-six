import {pathToFileURL} from 'node:url';
import {sep} from 'node:path';

import {isStopTest} from '../State.js';
import EventServer from '../utils/EventServer.js';

const srcName = new URL('../', import.meta.url),
  baseName = pathToFileURL(Deno.cwd() + sep);

export default class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks = globalThis.navigator?.hardwareConcurrency || 1, options) {
    super(reporter, numberOfTasks, options);
    this.counter = 0;
    this.idToWorker = {};
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
      try {
        this.report(id, msg);
      } catch (error) {
        if (!isStopTest(error)) throw error;
      }
      if (msg.type === 'end' && msg.test === 0) {
        this.close(id);
        return;
      }
    });
    worker.addEventListener('error', error => {
      this.report(id, {
        type: 'comment',
        name: 'fail to load: ' + (error.message || 'Worker error'),
        test: 0
      });
      try {
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
      } catch (error) {
        if (!isStopTest(error)) throw error;
      }
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
  destroyTask(id) {
    const worker = this.idToWorker[id];
    if (worker) {
      worker.terminate();
      delete this.idToWorker[id];
    }
  }
}
