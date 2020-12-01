import EventServer from '../src/utils/EventServer.js';

export default class TestWorker extends EventServer {
  constructor(...args) {
    super(...args);
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
      iframe.src = '/' + fileName + '?id=' + id + (this.options.failOnce ? '&flags=F' : '');
      iframe.onerror = error => window.__tape6_error(id, error);
      document.body.append(iframe);
    } else {
      document.body.append(iframe);
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>Test IFRAME</title>
            <script type="module">
              window.__tape6_id = ${JSON.stringify(id)};
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
