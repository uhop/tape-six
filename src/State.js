import {getTimer} from './timer.js';

class State {
  constructor(parent, {callback, skip, todo}) {
    this.parent = parent;
    parent = parent || {};
    this.callback = callback || parent.callback;
    this.skip = skip || parent.skip;
    this.todo = todo || parent.todo;
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
    const originalEvent = event;
    event = {...event};
    !event.type && (event.type = 'assert');

    switch (event.type) {
      case 'assert':
        ++this.asserts;
        (this.skip || event.skip) && ++this.skipped;
        event.fail && !this.todo && !event.todo && !this.skip && !event.skip && ++this.failed;
        event.id = this.asserts;
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
      this.time = this.timer.now();
    }
  }
}

export default State;
