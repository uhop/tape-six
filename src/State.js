import {getTimer} from './timer.js';

// const getLocation = /\(([^)]+)\)$/;

class State {
  constructor(callback, skip, todo) {
    this.callback = callback;
    this.skip = skip;
    this.todo = todo;
    this.plan = -1;
    this.asserts = this.skipped = this.failed = 0;
    this.timer = getTimer();
    this.startTime = this.time = this.timer.now();
  }

  setPlan(n) {
    this.plan = n;
    this.emit({type: 'plan'});
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
      // const location = getLocation.exec(event.at);
      // location && (event.at = location[1]);
    }

    if (!event.at && event.marker && typeof event.marker.stack == 'string') {
      const lines = event.marker.stack.split('\n');
      event.at = lines[Math.min(3, lines.length) - 1].trim().replace(/^at\s+/i, '');
      // const location = getLocation.exec(event.at);
      // location && (event.at = location[1]);
    }

    this.callback(event);

    if (event.type === 'assert') {
      this.time = this.timer.now();
    }

    if (this.plan >= 0 && this.asserts > this.plan) {
      this.emit({fail: true, name: 'plan != count', marker: originalEvent.marker, time: originalEvent.time, data: {expected: this.plan, actual: this.asserts}});
      this.plan = -1;
    }
  }
}

export default State;
