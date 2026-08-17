import Reporter from '../src/reporters/Reporter.js';
import {formatNumber} from '../src/utils/formatters.js';

const tagsToReplace = {'&': '&amp;', '<': '&lt;', '>': '&gt;'};
const escapeHtml = string => string.replace(/[&<>]/g, tag => tagsToReplace[tag] || tag);

const formatName = event =>
  '<span class="' +
  (event.fail ? 'text-failure' : 'text-success') +
  '">' +
  ((event.skip && '<span class="text-skipped">SKIP</span>&nbsp;') || '') +
  ((event.todo && '<span class="text-todo">TODO</span>&nbsp;') || '') +
  escapeHtml(event.name || '') +
  '</span>';

export class DashReporter extends Reporter {
  constructor({failOnce = false, renumberAsserts = false} = {}) {
    super({failOnce});
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;
    this.depth = this.assertCounter = this.failureCounter = this.skipCounter = this.todoCounter = 0;
    this.testCounter = 0;
    // a bail-out scores no assertion, so the count-derived verdict reads green
    this.bailedOut = false;
    this.currentTest = this.lastAssert = '';
    this.scoreNode = document.querySelector('.tape6 .score');
    this.donutNode = this.scoreNode && this.scoreNode.querySelector('tape6-donut');
    this.legendNode = document.querySelector('.tape6 .legend');
    this.spinnerNode = document.querySelector('.tape6 tape6-spinner');
    // Lives beside the donut's <svg>, not inside it: show() clears the svg on
    // every assert, and re-creating the node would restart its animation each
    // time — a fast suite would render it frozen.
    this.donutStatus = null;
    if (this.donutNode) {
      this.donutStatus = document.createElement('div');
      this.donutStatus.className = 'donut-status';
      this.donutNode.appendChild(this.donutStatus);
    }
    this.running = true;
  }
  report(event, suppressStopTest = false) {
    event = this.state?.preprocess(event) || event;
    switch (event.type) {
      case 'test':
        event = this.onTest(event);
        if (event.name || event.test > 0) {
          ++this.testCounter;
        }
        this.currentTest = formatName(event);
        this.updateDashboard();
        break;
      case 'end':
        this.onEnd(event);
        if (!this.state) {
          this.running = false;
          this.updateDashboard();
        }
        break;
      case 'terminated':
        this.onTerminated(event);
        break;
      case 'bail-out':
        this.bailedOut = true;
        this.updateDashboard();
        break;
      case 'assert':
        ++this.assertCounter;
        event.fail && !event.skip && !event.todo && ++this.failureCounter;
        event.skip && ++this.skipCounter;
        event.todo && ++this.todoCounter;
        this.lastAssert = formatName(event);
        this.updateDashboard();
        break;
    }
    this.state?.postprocess(event, suppressStopTest);
  }
  updateDashboard() {
    this.updateDonut();
    this.updateLegend();
    this.updateStatus();
    this.updateScoreCard();
  }
  updateDonut() {
    if (!this.donutNode) return;
    const total = this.assertCounter - this.skipCounter,
      success = total - this.failureCounter;
    this.donutNode.show([
      {value: success, className: 'success'},
      // an aborted run scores nothing, so with no slice of its own the donut
      // renders its empty state — green by absence
      {value: this.failureCounter || (this.bailedOut ? 1 : 0), className: 'failure'},
      {value: this.skipCounter, className: 'skipped'},
      {value: this.todoCounter, className: 'todo'}
    ]);
  }
  updateLegend() {
    if (!this.legendNode) return;
    const total = this.assertCounter - this.skipCounter,
      success = total - this.failureCounter;
    let node = this.legendNode.querySelector('.legend-tests .value');
    node && (node.innerHTML = formatNumber(this.testCounter));
    node = this.legendNode.querySelector('.legend-asserts .value');
    node && (node.innerHTML = formatNumber(this.assertCounter));
    node = this.legendNode.querySelector('.legend-success .value');
    node && (node.innerHTML = formatNumber(success));
    node = this.legendNode.querySelector('.legend-failure .value');
    node && (node.innerHTML = formatNumber(this.failureCounter));
    node = this.legendNode.querySelector('.legend-skipped .value');
    node && (node.innerHTML = formatNumber(this.skipCounter));
    node = this.legendNode.querySelector('.legend-todo .value');
    node && (node.innerHTML = formatNumber(this.todoCounter));
  }
  updateStatus() {
    this.donutStatus?.classList.toggle('running', this.running);
    if (!this.spinnerNode) return;
    this.spinnerNode[this.running ? 'show' : 'hide']();
  }
  updateScoreCard() {
    if (!this.scoreNode) return;
    const total = this.assertCounter - this.skipCounter,
      success = total - this.failureCounter,
      // the percentage stays an assertion statistic; the verdict does not
      fail = success < total || this.bailedOut,
      // mid-run "All good!" is a claim about tests that have not run yet, so a
      // clean run in progress gets a state of its own; a failure is already true
      // the moment it lands, and going red early is the point of watching
      state = fail ? 'failure-dark' : this.running ? 'running-dark' : 'success-dark';

    let node = this.scoreNode.querySelector('.text');
    node.classList.remove('nothing', 'success-dark', 'failure-dark', 'running-dark');
    node.classList.add(state);

    node = this.scoreNode.querySelector('.message');
    while (node.lastChild) node.removeChild(node.lastChild);
    node.appendChild(
      document.createTextNode(
        this.running ? 'Running tests…' : fail ? 'Need some work' : 'All good!'
      )
    );

    let result;
    if (this.running) {
      // counts, not a percentage: a percentage of an unfinished run reads as a verdict
      result = formatNumber(success) + ' passed';
      if (this.failureCounter) result += ', ' + formatNumber(this.failureCounter) + ' failed';
    } else {
      result = (total > 0 ? formatNumber(100 * (success / total), 1) : '100') + '% passed';
    }
    node = this.scoreNode.querySelector('.result');
    while (node.lastChild) node.removeChild(node.lastChild);
    node.appendChild(document.createTextNode(result));
  }
}

export default DashReporter;
