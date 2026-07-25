import EventServer from '../src/utils/EventServer.js';
import {isStopTest} from '../src/State.js';
import {htmlTestUrl, iframeId, terminateMessage, testPageSrcdoc} from '../src/driver/bootstrap.js';

export default class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks, options) {
    super(reporter, numberOfTasks, options);

    this.importmap = options?.importmap;
    this.counter = 0;
    this.graceTimers = {};

    window.__tape6_reporter = (id, event) => {
      this.report(id, event);
      if ((event.type === 'end' && event.test === 0) || event.type === 'terminated') {
        this.close(id);
      }
    };
    window.__tape6_error = (id, error) => {
      if (error) {
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
      }
      this.close(id);
    };
  }
  makeTask(fileName) {
    const id = String(++this.counter),
      flags = this.options.flags || '',
      iframe = document.createElement('iframe');
    iframe.id = iframeId(id);
    iframe.className = 'test-iframe';
    if (/\.html?$/i.test(fileName)) {
      iframe.src = htmlTestUrl(fileName, {id, flags});
      iframe.onerror = error => window.__tape6_error(id, error);
    } else {
      iframe.srcdoc = testPageSrcdoc(fileName, {id, flags, importmap: this.importmap});
    }
    document.body.append(iframe);
    return id;
  }
  destroyTask(id, reason = 'done') {
    if (reason === 'done') {
      this.#removeIframe(id);
      return;
    }
    // in-page JS can't force-kill a hung iframe script — iframe removal after
    // graceTimeout is a best-effort backstop; a real kill needs a driver
    // (puppeteer / playwright). See dev-docs/worker-control-channel.md.
    if (this.graceTimers[id]) return;
    const iframe = document.getElementById(iframeId(id));
    if (!iframe) return;
    try {
      iframe.contentWindow?.postMessage(terminateMessage(reason), '*');
    } catch (e) {
      void e;
    }
    this.graceTimers[id] = setTimeout(() => this.#removeIframe(id), this.graceTimeout);
  }
  #removeIframe(id) {
    const grace = this.graceTimers[id];
    if (grace) {
      clearTimeout(grace);
      delete this.graceTimers[id];
    }
    const iframe = document.getElementById(iframeId(id));
    iframe && iframe.parentElement && iframe.parentElement.removeChild(iframe);
  }
}
