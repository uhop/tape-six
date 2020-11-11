import {getTimer} from './timer.js';

export class StopTest extends Error {}

class State {
  constructor(parent, {callback, skip, todo, failOnce}) {
    this.parent = parent;
    parent = parent || {};
    this.callback = callback || parent.callback;
    this.skip = skip || parent.skip;
    this.todo = todo || parent.todo;
    this.failOnce = failOnce || parent.failOnce;
    this.offset = parent.asserts || 0;
    this.timer = parent.timer || getTimer();
    this.asserts = this.skipped = this.failed = 0;
    this.startTime = this.time = this.timer.now();
  }

  updateParent() {
    if (!this.parent) return;
    this.parent.asserts += this.asserts;
    this.parent.skipped += this.skipped;
    this.parent.failed += this.failed;
  }

  emit(event) {
    event = {...event, skip: event.skip || this.skip, todo: event.todo || this.todo};
    !event.type && (event.type = 'assert');

    const isFailed = event.fail && !event.todo && !event.skip;

    switch (event.type) {
      case 'assert':
        ++this.asserts;
        event.skip && ++this.skipped;
        isFailed && ++this.failed;
        event.id = this.asserts + this.offset;
        event.diffTime = event.time - this.time;
        break;
      case 'end':
        event.diffTime = event.time - this.startTime;
        break;
    }

    if (event.type === 'assert' && event.operator === 'error' && event.data && event.data.actual && typeof event.data.actual.stack == 'string') {
      const lines = event.data.actual.stack.split('\n');
      event.at = lines[Math.min(2, lines.length) - 1].trim().replace(/^at\s+/i, '');
    }

    if (!event.at && event.marker && typeof event.marker.stack == 'string') {
      const lines = event.marker.stack.split('\n');
      event.at = lines[Math.min(3, lines.length) - 1].trim().replace(/^at\s+/i, '');
    }

    this.callback(event);

    if (event.type === 'assert') {
      if (isFailed && this.failOnce && !this.skip) {
        for (let state = this; state; state = state.parent) state.skip = true;
        throw new StopTest('failOnce is activated');
      }
      this.time = this.timer.now();
    }
  }
}

export default State;
