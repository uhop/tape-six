import {selectTimer} from '../src/utils/timer.js';
import {getReporter, setReporter, setConfiguredFlag} from '../src/test.js';
import defer from '../src/utils/defer.js';
import State from '../src/State.js';
import TapReporter from '../src/TapReporter.js';
import DomReporter from './DomReporter.js';
import DashReporter from './DashReporter.js';
import TestWorker from './TestWorker.js';

setConfiguredFlag(true); // we are running the show

const optionNames = {f: 'failureOnly', t: 'showTime', b: 'showBanner', d: 'showData', o: 'failOnce', s: 'showStack', l: 'showLog', n: 'showAssertNumber'},
  options = {};

let flags = '',
  parallel = 1,
  patterns = [];

if (window.location.search) {
  const searchParams = new URLSearchParams(window.location.search.substring(1));
  flags = searchParams.get('flags') || '';
  parallel = searchParams.get('par') || '';
  if (parallel && !isNaN(parallel)) {
    parallel = +parallel;
    parallel = Math.min(100, Math.max(1, parallel));
  } else {
    parallel = 1;
  }
  patterns = searchParams.getAll('q');
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

    const rootState = new State(null, {callback: getReporter(), failOnce: options.failOnce}),
      worker = new TestWorker(event => rootState.emit(event), parallel, options);

    await new Promise(resolve => {
      worker.done = () => resolve();
      worker.execute(files);
    });

    if (typeof window.__tape6_reportResults == 'function') {
      await window.__tape6_reportResults(rootState.failed > 0 ? 'failure' : 'success');
    }
  });
});
