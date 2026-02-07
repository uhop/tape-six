import process from 'node:process';
import {sep} from 'node:path';
import {pathToFileURL} from 'node:url';

import {isStopTest} from '../../State.js';
import EventServer from '../../utils/EventServer.js';
import {getOriginalConsole, setCurrentReporter} from '../../utils/capture-console.js';
import {
  clearBeforeAll,
  clearAfterAll,
  clearBeforeEach,
  clearAfterEach,
  setReporter,
  registerNotifyCallback
} from '../../test.js';
import BypassReporter from './BypassReporter.js';

const baseName = pathToFileURL(process.cwd() + sep);

export default class TestWorker extends EventServer {
  constructor(reporter, _numberOfTasks, options) {
    super(reporter, 1, options);
    this.testRunner = options.testRunner;
    this.counter = 0;
    this.originalConsole = getOriginalConsole() || globalThis.console;
  }
  makeTask(fileName) {
    const id = String(++this.counter),
      reporter = new BypassReporter(this.reporter, event => {
        try {
          this.report(id, event);
        } catch (error) {
          if (!isStopTest(error)) throw error;
        }
        if (event.type === 'end' && event.test === 0) {
          this.close(id);
        }
      });
    setReporter(reporter);
    setCurrentReporter(this.reporter);
    process.env.TAPE6_TEST_FILE_NAME = fileName;
    import(new URL(fileName, baseName))
      .then(async () => {
        const testRunner = await this.testRunner;
        registerNotifyCallback(testRunner);
      })
      .catch(error => {
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
}
