import process from 'node:process';
import {sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';

import {StopTest} from '../State.js';
import EventServer from '../utils/EventServer.js';

const utilName = new URL('../test.js', import.meta.url),
  baseName = pathToFileURL(process.cwd() + sep);

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
      });
    this.idToWorker[id] = worker;
    worker.on('message', msg => {
      try {
        this.report(id, msg);
      } catch (error) {
        if (!(error instanceof StopTest)) throw error;
      }
      if (msg.type === 'end' && msg.test === 0) {
        this.close(id);
        return;
      }
    });
    worker.on('error', error => {
      this.report(id, {
        type: 'comment',
        name: 'fail to load: ' + (error.message || 'Worker error`'),
        test: 0
      });
      this.close(id);
    });
    worker.on('messageerror', error => {
      this.report(id, {
        type: 'comment',
        name: 'fail to load: ' + (error.message || 'Worker error`'),
        test: 0
      });
      this.close(id);
    });
    worker.postMessage({testName: testName.href, utilName: utilName.href});
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
