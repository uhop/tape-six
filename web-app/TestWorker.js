import EventServer from '../src/utils/EventServer.js';

export default class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks, options) {
    super(reporter, numberOfTasks, options);

    this.importmap = options?.importmap;
    this.counter = 0;

    window.__tape6_reporter = (id, event) => {
      this.report(id, event);
      if (event.type === 'end' && event.test === 0) this.close(id);
    };
    window.__tape6_error = (id, error) => {
      error && this.report(id, {type: 'comment', name: 'fail to load: ' + error.message, test: 0});
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
              window.__tape6_test_file_name = ${JSON.stringify(fileName)};
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
  destroyTask(id) {
    const iframe = document.getElementById('test-iframe-' + id);
    iframe && iframe.parentElement.removeChild(iframe);
  }
}
