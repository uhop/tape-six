import EventServer from '../src/utils/EventServer.js';
import {isStopTest} from '../src/State.js';

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
    const id = String(++this.counter);
    const iframe = document.createElement('iframe');
    iframe.id = 'test-iframe-' + id;
    iframe.className = 'test-iframe';
    if (/\.html?$/i.test(fileName)) {
      const search = new URLSearchParams({id, 'test-file-name': fileName});
      if (this.options.failOnce) search.set('flags', 'F');
      iframe.src = '/' + fileName + '?' + search.toString();
      iframe.onerror = error => window.__tape6_error(id, error);
      document.body.append(iframe);
    } else {
      document.body.append(iframe);
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(`
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Test IFRAME</title>
            ${
              this.importmap
                ? `<script type="importmap">${JSON.stringify(this.importmap)}</script>`
                : ''
            }
            <script type="module">
              window.__tape6_id = ${JSON.stringify(id)};
              window.__tape6_testFileName = ${JSON.stringify(fileName)};
              window.__tape6_flags = "${this.options.failOnce ? 'F' : ''}";
              const s = document.createElement('script');
              s.setAttribute('type', 'module');
              s.src = '/${fileName}';
              s.onerror = error => window.parent.__tape6_error(window.__tape6_id, error);
              document.documentElement.appendChild(s);
            </script>
          </head>
          <body></body>
        </html>
      `);
      iframe.contentWindow.document.close();
    }
    return id;
  }
  destroyTask(id, reason = 'done') {
    if (reason === 'done') {
      this.#removeIframe(id);
      return;
    }
    // Cooperative drain only — in-page JS can't force-kill a hung iframe script.
    // postMessage `terminate` so a cooperative test unwinds and runs its cleanup
    // hooks; if it doesn't exit within graceTimeout, remove the iframe as a
    // best-effort backstop. A driver-backed run (puppeteer / playwright) can do
    // a real kill from Node — not wired here. See dev-docs/worker-control-channel.md.
    if (this.graceTimers[id]) return;
    const iframe = document.getElementById('test-iframe-' + id);
    if (!iframe) return;
    try {
      iframe.contentWindow?.postMessage({type: 'tape6-terminate', reason}, '*');
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
    const iframe = document.getElementById('test-iframe-' + id);
    iframe && iframe.parentElement && iframe.parentElement.removeChild(iframe);
  }
}
