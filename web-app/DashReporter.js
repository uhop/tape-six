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
    this.depth = this.assertCounter = this.failureCounter = this.skipCounter = this.todoCounter = 0;
    this.testCounter = -1;
    this.currentTest = this.lastAssert = '';
    this.scoreNode = document.querySelector('.tape6 .score');
    this.donutNode = this.scoreNode && this.scoreNode.querySelector('tape6-donut');
    this.legendNode = document.querySelector('.tape6 .legend');
    this.spinnerNode = document.querySelector('.tape6 tape6-spinner');
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
        event.fail && !event.skip && !event.todo && ++this.failureCounter;
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
    const total = this.assertCounter - this.skipCounter,
      success = total - this.failureCounter;
    this.donutNode.show([
      {value: success, className: 'success'},
      {value: this.failureCounter, className: 'failure'},
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
    if (!this.spinnerNode) return;
    this.spinnerNode[this.running ? 'show' : 'hide']();
  }
  updateScoreCard() {
    if (!this.scoreNode) return;
    const total = this.assertCounter - this.skipCounter,
      success = total - this.failureCounter,
      fail = success < total,
      result = total > 0 ? formatNumber(100 * (success / total), 1) : '100';
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
