import {getTests, clearTests, getReporter, setReporter, runTests, setConfiguredFlag} from '../src/test.js';
import defer from '../src/utils/defer.js';
import State from '../src/State.js';
import TapReporter from '../src/TapReporter.js';
import DomReporter from './DomReporter.js';
import DashReporter from './DashReporter.js';

setConfiguredFlag(true); // we are running the show

const optionNames = {f: 'failureOnly', t: 'showTime', b: 'showBanner', d: 'showData', o: 'failOnce'},
  options = {};

let flags = '';

if (window.location.search) {
  const dict = window.location.search
    .substr(1)
    .split('&')
    .map(pair => pair.split(/=/))
    .reduce((acc, pair) => ((acc[pair[0]] = pair[1]), acc), {});
  flags = dict.flags || '';
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
  setReporter(event => (tapReporter.report(event), domReporter.report(event), dashReporter.report(event)));

  const donut = document.querySelector('tape6-donut');
  donut.show([{value: 0, className: 'nothing'}], {
    center: {x: 100, y: 100},
    gap: 4,
    innerRadius: 40,
    radius: 90,
    startAngle: Math.PI / 2,
    emptyClass: 'nothing'
  });

  defer(async () => {
    const rootState = new State(null, {callback: getReporter(), failOnce: options.failOnce});

    rootState.emit({type: 'test', test: 0, time: rootState.timer.now()});
    for (;;) {
      const tests = getTests();
      if (!tests.length) break;
      clearTests();
      await runTests(rootState, tests);
    }
    rootState.emit({type: 'end', test: 0, time: rootState.timer.now(), fail: rootState.failed > 0, data: rootState});

    if (typeof __reportTape6Results == 'function') {
      __reportTape6Results(rootState.failed > 0 ? 'failure' : 'success');
    }
  });
});
