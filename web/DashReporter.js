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

class DashReporter {
  constructor({renumberAsserts = false} = {}) {
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;
    this.depth = this.testCounter = this.assertCounter = this.successCounter = this.failureCounter = this.skipCounter = this.todoCounter = 0;
    this.currentTest = this.lastAssert = '';
    this.scoreNode = document.querySelector('.tape6 .score');
    this.donutNode = this.scoreNode && this.scoreNode.querySelector('tape6-donut');
    this.legendNode = document.querySelector('.tape6 .legend');
    this.statusNode = document.querySelector('.tape6 .status');
    this.running = true;
  }
  report(event) {
    switch (event.type) {
      case 'test':
        ++this.depth;
        ++this.testCounter;
        this.currentTest = formatName(event);
        this.updateDashboard();
        break;
      case 'end':
        if (!--this.depth) {
          this.running = false;
          this.updateDashboard();
        }
        break;
      case 'assert':
        ++this.assertCounter;
        event.fail && !event.skip && !event.todo ? ++this.failureCounter : ++this.successCounter;
        event.skip && ++this.skipCounter;
        event.todo && ++this.todoCounter;
        this.lastAssert = formatName(event);
        this.updateDashboard();
        break;
    }
  }
  updateDashboard() {
    this.updateDonut();
    this.updateLegend();
    this.updateStatus();
    this.updateScoreCard();
  }
  updateDonut() {
    if (!this.donutNode) return;
    this.donutNode.show([
      {value: this.successCounter, className: 'success'},
      {value: this.failureCounter, className: 'failure'},
      {value: this.skipCounter, className: 'skipped'},
      {value: this.todoCounter, className: 'todo'}
    ]);
  }
  updateLegend() {
    if (!this.legendNode) return;
    let node = this.legendNode.querySelector('.legend-tests .value');
    node && (node.innerHTML = formatNumber(this.testCounter));
    node = this.legendNode.querySelector('.legend-asserts .value');
    node && (node.innerHTML = formatNumber(this.assertCounter));
    node = this.legendNode.querySelector('.legend-success .value');
    node && (node.innerHTML = formatNumber(this.successCounter));
    node = this.legendNode.querySelector('.legend-failure .value');
    node && (node.innerHTML = formatNumber(this.failureCounter));
    node = this.legendNode.querySelector('.legend-skipped .value');
    node && (node.innerHTML = formatNumber(this.skipCounter));
    node = this.legendNode.querySelector('.legend-todo .value');
    node && (node.innerHTML = formatNumber(this.todoCounter));
  }
  updateStatus() {
    if (!this.statusNode) return;
    if (this.running) {
      let node = this.statusNode.querySelector('tape6-spinner');
      node.classList.remove('stop');
      node = this.statusNode.querySelector('.status-test');
      node.innerHTML = 'Running test: ' + this.currentTest;
      node = this.statusNode.querySelector('.status-assert');
      node.innerHTML = 'Last assert: ' + this.lastAssert;
    } else {
      let node = this.statusNode.querySelector('tape6-spinner');
      node.classList.add('stop');
      node = this.statusNode.querySelector('.status-test');
      while (node.lastChild) node.removeChild(node.lastChild);
      node.appendChild(document.createTextNode('All done.'));
      node = this.statusNode.querySelector('.status-assert');
      while (node.lastChild) node.removeChild(node.lastChild);
    }
  }
  updateScoreCard() {
    if (!this.scoreNode) return;
    const total = this.assertCounter - this.skipCounter,
      fail = this.successCounter < total,
      result = total > 0 ? formatNumber(100 * (this.successCounter / total), 1) : '100';
    let node = this.scoreNode.querySelector('.text');
    node.classList.remove('nothing');
    if (fail) {
      node.classList.remove('success-dark');
      node.classList.add('failure-dark');
    } else {
      node.classList.remove('failure-dark');
      node.classList.add('success-dark');
    }
    node = this.scoreNode.querySelector('.message');
    while (node.lastChild) node.removeChild(node.lastChild);
    node.appendChild(document.createTextNode(fail ? 'Need some work' : 'All good!'));
    node = this.scoreNode.querySelector('.result');
    while (node.lastChild) node.removeChild(node.lastChild);
    node.appendChild(document.createTextNode(result + '% passed'));
  }
}

export default DashReporter;
