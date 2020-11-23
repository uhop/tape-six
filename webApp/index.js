import {selectTimer} from '../src/utils/timer.js';
import {getReporter, setReporter, setConfiguredFlag} from '../src/test.js';
import defer from '../src/utils/defer.js';
import Deferred from '../src/utils/Deferred.js';
import State from '../src/State.js';
import TapReporter from '../src/TapReporter.js';
import DomReporter from './DomReporter.js';
import DashReporter from './DashReporter.js';

setConfiguredFlag(true); // we are running the show

const optionNames = {f: 'failureOnly', t: 'showTime', b: 'showBanner', d: 'showData', o: 'failOnce', s: 'showStack', l: 'showLog'},
  options = {};

let flags = '';

if (window.location.search) {
  const searchParams = new URLSearchParams(window.location.search.substr(1));
  flags = searchParams.get('flags') || '';
}

for (let i = 0; i < flags.length; ++i) {
  const option = flags[i].toLowerCase(),
    name = optionNames[option];
  if (typeof name == 'string') options[name] = option !== flags[i];
}

window.addEventListener('DOMContentLoaded', () => {
  const tools = document.querySelector('.tape6 form.tools');
  if (tools) {
    const report = document.querySelector('.tape6 .report'),
      failedOnly = tools.querySelector('input[name="failed-only"]'),
      showData = tools.querySelector('input[name="show-data"]'),
      showStack = tools.querySelector('input[name="show-stack"]');
    failedOnly.checked = !!options.failureOnly;
    report.classList[options.failureOnly ? 'add' : 'remove']('failed-only');
    showData.checked = !!options.showData;
    report.classList[options.showData ? 'remove' : 'add']('hide-data');
    showStack.checked = !!options.showStack;
    report.classList[options.showStack ? 'remove' : 'add']('hide-stack');
    showStack.disabled = !options.showData;
    tools.onsubmit = () => false;
    tools.onclick = event => {
      if (event.target === failedOnly) {
        report.classList[event.target.checked ? 'add' : 'remove']('failed-only');
      } else if (event.target === showData) {
        report.classList[event.target.checked ? 'remove' : 'add']('hide-data');
        showStack.disabled = !event.target.checked;
      } else if (event.target === showStack) {
        report.classList[event.target.checked ? 'remove' : 'add']('hide-stack');
      }
    };
  }

  const tapReporter = new TapReporter({useJson: true}),
    domReporter = new DomReporter({root: document.querySelector('.tape6 .report')}),
    dashReporter = new DashReporter();
  setReporter(event => (options.showLog && tapReporter.report(event), domReporter.report(event), dashReporter.report(event)));

  const donut = document.querySelector('tape6-donut');
  donut.show([{value: 0, className: 'nothing'}], {
    center: {x: 100, y: 100},
    // gap: 4,
    innerRadius: 40,
    radius: 90,
    startAngle: Math.PI / 2,
    emptyClass: 'nothing'
  });

  defer(async () => {
    await selectTimer();

    let files;

    if (window.location.search) {
      const searchParams = new URLSearchParams(window.location.search.substr(1)),
        patterns = searchParams.getAll('q');
      if (patterns && patterns.length) {
        files = await fetch('/--patterns?' + patterns.map(pattern => 'q=' + encodeURIComponent(pattern)).join('&')).then(response =>
          response.ok ? response.json() : null
        );
      }
    }

    if (!files || !files.length) {
      files = await fetch('/--tests').then(response => (response.ok ? response.json() : null));
    }

    if (!files || !files.length) {
      alert('No tests were specified for a browser!');
      return;
    }

    const rootState = new State(null, {callback: getReporter(), failOnce: options.failOnce});

    for (const file of files) {
      rootState.emit({type: 'comment', name: 'file: /' + file, test: 0, time: rootState.timer.now()});
      const iframe = document.createElement('iframe'),
        deferred = new Deferred();
      iframe.className = 'test-iframe';
      window.__tape6_reporter = event => {
        rootState.emit(event);
        if (event.type === 'end' && event.test === 0) deferred.resolve();
      };
      if (/\.html?$/i.test(file)) {
        iframe.src = '/' + file;
        iframe.onerror = error => deferred.reject(error);
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
                const s = document.createElement('script');
                s.setAttribute('type', 'module');
                s.src = '/${file}';
                s.onerror = error => window.parent.__tape6_error(error);
                document.documentElement.appendChild(s);
              </script>
            </head>
            <body></body>
          </html>
        `);
        iframe.contentWindow.document.close();
        window.__tape6_error = error => deferred.reject(error);
      }
      try {
        await deferred.promise;
      } catch (error) {
        rootState.emit({type: 'comment', name: 'fail to load: /' + file, test: 0, time: rootState.timer.now()});
      }
      iframe.parentElement.removeChild(iframe);
    }

    if (typeof window.__tape6_reportResults == 'function') {
      window.__tape6_reportResults(rootState.failed > 0 ? 'failure' : 'success');
    }
  });
});
