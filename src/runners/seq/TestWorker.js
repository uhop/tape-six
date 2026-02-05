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
  getReporter
} from '../../test.js';
import ProxyReporter from '../../reporters/ProxyReporter.js';

const baseName = pathToFileURL(process.cwd() + sep);

export default class TestWorker extends EventServer {
  constructor(reporter, _numberOfTasks, options) {
    super(reporter, 1, options);
    this.counter = 0;
    this.originalConsole = getOriginalConsole() || globalThis.console;
  }
  makeTask(fileName) {
    const id = String(++this.counter),
      reporter = new ProxyReporter({
        ...this.options,
        reportTo: event => {
          const reporter = getReporter();
          setReporter(this.reporter);
          try {
            this.report(id, event);
          } catch (error) {
            if (!isStopTest(error)) throw error;
          } finally {
            setReporter(reporter);
          }
          if (event.type === 'end' && event.test === 0) {
            this.close(id);
          }
        }
      });
    setReporter(reporter);
    setCurrentReporter(this.reporter);
    process.env.TAPE6_TEST_FILE_NAME = fileName;
    process.env.TAPE6_SKIP_EXIT = 'y';
    import(new URL(fileName, baseName)).catch(error => {
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
  destroyTask(id) {
    setReporter(this.reporter);
    setCurrentReporter(null);
    clearBeforeAll();
    clearAfterAll();
    clearBeforeEach();
    clearAfterEach();
  }
}
