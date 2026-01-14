import process from 'node:process';
import {sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';

import {StopTest} from '../State.js';
import EventServer from '../utils/EventServer.js';

import lines from '../chain/lines.js';
import parse from '../chain/parse-prefixed-jsonl.js';
import wrap from '../chain/wrap-lines.js';

const srcName = new URL('../', import.meta.url),
  baseName = pathToFileURL(process.cwd() + sep);

export default class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks = globalThis.navigator?.hardwareConcurrency || 1, options) {
    super(reporter, numberOfTasks, options);
    this.counter = 0;
    this.idToWorker = {};
    this.prefix = randomUUID();
  }
  makeTask(fileName) {
    const testName = new URL(fileName, baseName),
      id = String(++this.counter),
      worker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
        env: {
          ...process.env,
          TAPE6_TEST: id,
          TAPE6_REPORTER: 'jsonl',
          TAPE6_JSONL: 'Y',
          TAPE6_JSONL_PREFIX: this.prefix
        },
        stdout: true,
        stderr: true
      });
    this.idToWorker[id] = worker;
    const self = this;
    Readable.toWeb(worker.stdout)
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(lines())
      .pipeThrough(parse(this.prefix))
      .pipeTo(
        new WritableStream({
          write(msg) {
            try {
              self.report(id, msg);
            } catch (error) {
              if (!(error instanceof StopTest)) {
                throw error;
              }
            }
            if (msg.type === 'end' && msg.test === 0) {
              self.close(id);
              return;
            }
          }
        })
      );
    Readable.toWeb(worker.stderr)
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(lines())
      .pipeThrough(wrap('stderr'))
      .pipeTo(
        new WritableStream({
          write(msg) {
            self.report(id, msg);
          }
        })
      );
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
    worker.postMessage({testName: testName.href, srcName: srcName.href});
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
