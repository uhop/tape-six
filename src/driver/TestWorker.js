// @ts-self-types="./TestWorker.d.ts"

import {isStopTest} from '../State.js';
import EventServer from '../utils/EventServer.js';
import {
  htmlTestUrl,
  iframeId,
  supportedTestFileRe,
  terminateMessage,
  testPageSrcdoc
} from './bootstrap.js';

export class TestWorker extends EventServer {
  #ready;
  constructor(reporter, numberOfTasks, options) {
    super(reporter, numberOfTasks, options);
    this.counter = 0;
    this.browser = null;
    this.tasks = {};
    this.graceTimers = {};
    // deferred a microtask: subclass field initializers (the adapter members)
    // run only after super() returns — #init must not read them earlier
    this.#ready = Promise.resolve().then(() => this.#init());
  }

  // the driver adapter — subclasses supply these four members
  get supportedBrowsers() {
    throw new Error('TestWorker subclass must define supportedBrowsers');
  }
  get pageErrorEvent() {
    throw new Error('TestWorker subclass must define pageErrorEvent');
  }
  async launchBrowser() {
    throw new Error('TestWorker subclass must implement launchBrowser(name, {insecure})');
  }
  async newContext() {
    throw new Error('TestWorker subclass must implement newContext(browser, {insecure})');
  }

  // diagnostic sink — embedders/tests may override (the default is fine in driver bins)
  logError(...args) {
    console.error(...args);
  }

  get insecure() {
    return /^https:/i.test(this.options.serverUrl || '');
  }

  async #init() {
    const name = this.options.browser || this.supportedBrowsers[0];
    if (!this.supportedBrowsers.includes(name)) {
      throw new Error(
        `Unsupported browser "${name}". Supported: ${this.supportedBrowsers.join(', ')}.`
      );
    }
    this.browser = await this.launchBrowser(name, {insecure: this.insecure});
  }

  makeTask(fileName) {
    const id = String(++this.counter);
    if (!supportedTestFileRe.test(fileName)) {
      this.report(id, {
        name: 'unsupported file type: ' + fileName,
        test: 0,
        marker: new Error(),
        operator: 'error',
        fail: true
      });
      this.report(id, {type: 'terminated', test: 0, name: 'FILE: /' + fileName});
      this.close(id);
      return id;
    }
    this.#ready
      .then(() => this.#runTask(id, fileName))
      .catch(error => {
        // Launch/setup failure (e.g. the engine isn't installed): no page
        // exists, so no 'close' event can drive completion — and without a
        // reported failure the run would exit 0 (a false pass).
        this.logError('Failed to run test:', fileName, error);
        try {
          this.report(id, {
            name: error && error.message ? error.message : String(error),
            test: 0,
            marker: new Error(),
            operator: 'error',
            fail: true
          });
        } catch (reportError) {
          if (!isStopTest(reportError)) throw reportError;
        }
        this.close(id);
      });
    return id;
  }

  // Each task runs in its own BrowserContext + Page (full origin/storage
  // isolation), so the Node-side driver can force-kill a hung test by closing
  // the context — the backstop in-page JS can't provide for itself. The test
  // still runs in an iframe inside that page, so the proven srcdoc / importmap
  // injection and the window.parent.__tape6_reporter data plane are unchanged.
  //
  // Completion is driven by the page 'close' event, never directly from a
  // reported event: a normal end, a cooperative drain, and a force-kill all end
  // in the context being closed, so close(id) fires exactly once per task down
  // every path — including the hung-test kill that emits no event at all.
  async #runTask(id, fileName) {
    let context, page;
    try {
      context = await this.newContext(this.browser, {insecure: this.insecure});
      page = await context.newPage();
    } catch (error) {
      this.logError('Failed to open context for:', fileName, error);
      if (context) context.close().catch(() => {});
      this.close(id);
      return;
    }
    this.tasks[id] = {context, page};

    page.on('close', () => {
      this.#clearGrace(id);
      if (this.tasks[id]) {
        delete this.tasks[id];
        this.close(id);
      }
    });
    page.on(this.pageErrorEvent, e => console.error(e));

    try {
      await page.exposeFunction('__tape6_reporter', (taskId, event) => {
        try {
          this.report(taskId, event);
          if ((event.type === 'end' && event.test === 0) || event.type === 'terminated') {
            this.destroyTask(taskId, 'done');
          }
        } catch (error) {
          if (!isStopTest(error)) throw error;
        }
      });

      await page.exposeFunction('__tape6_error', (taskId, error) => {
        if (error) {
          this.report(taskId, {
            type: 'comment',
            name: 'fail to load: ' + (error.message || 'Worker error'),
            test: 0
          });
          try {
            this.report(taskId, {
              name: String(error),
              test: 0,
              marker: new Error(),
              operator: 'error',
              fail: true,
              data: {actual: error}
            });
          } catch (error) {
            if (!isStopTest(error)) throw error;
          }
        }
        this.destroyTask(taskId, 'done');
      });

      // navigate to the server so the iframe inherits the correct origin
      await page.goto(this.options.serverUrl + '/--tests', {waitUntil: 'load'});
      await page.evaluate(() => {
        document.documentElement.innerHTML = '<head></head><body></body>';
      });

      // forward console messages only after the page is set up
      page.on('console', msg =>
        console[typeof console[msg.type()] == 'function' ? msg.type() : 'log'](msg.text())
      );

      await this.#runInIframe(id, page, fileName);

      // A stop/bail (or deadline) can fire while this context is still being
      // created — its destroyTask hits a not-yet-tracked task and no-ops. Catch
      // up now that the iframe exists so a just-started task still aborts.
      if (this.stopRequested) this.destroyTask(id, 'failOnce');
    } catch (error) {
      this.logError('Failed to set up test:', fileName, error);
      this.destroyTask(id, 'done');
    }
  }

  async #runInIframe(id, page, fileName) {
    const flags = this.options.flags || '',
      domId = iframeId(id);

    if (/\.html?$/i.test(fileName)) {
      const url = htmlTestUrl(fileName, {id, flags});
      await page.evaluate(
        ({id, domId, url}) => {
          const iframe = document.createElement('iframe');
          iframe.id = domId;
          iframe.src = url;
          iframe.onerror = error => /** @type {*} */ (window).__tape6_error(id, error);
          document.body.append(iframe);
        },
        {id, domId, url}
      );
    } else {
      const srcdoc = testPageSrcdoc(fileName, {id, flags, importmap: this.options.importmap});
      await page.evaluate(
        ({domId, srcdoc}) => {
          const iframe = document.createElement('iframe');
          iframe.id = domId;
          iframe.srcdoc = srcdoc;
          document.body.append(iframe);
        },
        {domId, srcdoc}
      );
    }
  }

  // Control plane. EventServer calls this with reason ∈ done | failOnce | timeout.
  destroyTask(id, reason = 'done') {
    if (reason === 'done') {
      this.#kill(id);
      return;
    }
    if (this.graceTimers[id]) return; // already draining
    const task = this.tasks[id];
    if (!task) return;
    // Cooperative drain: post `tape6-terminate` into the running test's iframe so
    // it unwinds at the next assertion (StopTest) and its cleanup hooks run. If
    // it doesn't exit within graceTimeout, force-kill by closing the context —
    // the real Node-side kill an in-page iframe can't perform on itself.
    task.page
      .evaluate(
        ({domId, message}) => {
          const iframe = /** @type {*} */ (document.getElementById(domId));
          iframe?.contentWindow?.postMessage(message, '*');
        },
        {domId: iframeId(id), message: terminateMessage(reason)}
      )
      .catch(() => {});
    this.graceTimers[id] = setTimeout(() => this.#kill(id), this.graceTimeout);
  }

  // Idempotent: the page 'close' handler clears tracking and calls close(id),
  // so a second call (e.g. base close() -> destroyTask('done')) finds no task
  // and returns.
  #kill(id) {
    this.#clearGrace(id);
    const task = this.tasks[id];
    if (!task) return;
    task.context.close().catch(() => {});
  }

  #clearGrace(id) {
    const grace = this.graceTimers[id];
    if (grace) {
      clearTimeout(grace);
      delete this.graceTimers[id];
    }
  }

  async cleanup() {
    for (const id of Object.keys(this.graceTimers)) {
      clearTimeout(this.graceTimers[id]);
    }
    this.graceTimers = {};
    // Drop task tracking first so the page 'close' events fired by browser.close()
    // below are no-ops (the run has already finished by the time cleanup runs).
    this.tasks = {};
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default TestWorker;
