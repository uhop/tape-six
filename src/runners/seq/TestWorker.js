import process from 'node:process';
import {sep} from 'node:path';
import {pathToFileURL} from 'node:url';

import EventServer from '../../utils/EventServer.js';
import {getTimeoutValue} from '../../utils/config.js';
import {getOriginalConsole, setCurrentReporter} from '../../utils/capture-console.js';
import {
  clearBeforeAll,
  clearAfterAll,
  clearBeforeEach,
  clearAfterEach,
  setReporter,
  registerNotifyCallback,
  unregisterNotifyCallback
} from '../../test.js';
import BypassReporter from './BypassReporter.js';

const baseName = pathToFileURL(process.cwd() + sep);

export default class TestWorker extends EventServer {
  constructor(reporter, _numberOfTasks, options) {
    super(reporter, 1, options);
    this.testRunner = options.testRunner;
    this.counter = 0;
    this.originalConsole = getOriginalConsole() || globalThis.console;
    this.timeout = getTimeoutValue();
    this.timeoutId = null;
  }
  makeTask(fileName) {
    const id = String(++this.counter),
      reporter = new BypassReporter(this.reporter, event => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
        this.report(id, event);
        if (event.type === 'end' && event.test === 0) {
          this.close(id);
        }
      });
    setReporter(reporter);
    setCurrentReporter(this.reporter);
    process.env.TAPE6_TEST_FILE_NAME = fileName;
    const url = new URL(fileName, baseName);
    import(url)
      .then(async () => {
        const testRunner = await this.testRunner;
        registerNotifyCallback(testRunner);
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
        this.timeoutId = setTimeout(() => {
          this.timeoutId = null;
          unregisterNotifyCallback(testRunner);
          this.#reportTimeout(id, fileName);
        }, this.timeout);
      })
      .catch(error => this.#reportError(id, error));
    return id;
  }
  destroyTask() {
    setReporter(this.reporter);
    setCurrentReporter(null);
    clearBeforeAll();
    clearAfterAll();
    clearBeforeEach();
    clearAfterEach();
  }
  #reportError(id, error) {
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
  }
  #reportTimeout(id, fileName) {
    this.report(id, {
      type: 'test',
      test: 0,
      name: 'FILE: /' + fileName
    });
    this.report(id, {
      name: `No tests found in ${this.timeout}ms`,
      test: 0,
      marker: new Error(),
      operator: 'error',
      fail: true
    });
    this.report(id, {
      type: 'end',
      test: 0,
      name: 'FILE: /' + fileName,
      fail: true
    });
    this.close(id);
  }
}
