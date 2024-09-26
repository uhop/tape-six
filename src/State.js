import {getTimer} from './utils/timer.js';

export class StopTest extends Error {}

export const signature = 'tape6-!@#$%^&*';

const replacer =
  (seen = new Set()) =>
  (_, value) => {
    if (typeof value == 'symbol')
      return {type: 'Symbol', value: value.toString(), [signature]: signature};

    if (value && typeof value == 'object') {
      if (value instanceof Error)
        return {
          type: 'Error',
          message: value.message,
          stack: value.stack,
          name: value.name,
          [signature]: signature
        };

      if (value instanceof RegExp)
        return {type: 'RegExp', source: value.source, flags: value.flags, [signature]: signature};

      if (value instanceof Set)
        return {type: 'Set', value: Array.from(value), [signature]: signature};

      if (value instanceof Map)
        return {type: 'Map', value: Object.fromEntries(value), [signature]: signature};

      // break circular references
      if (seen.has(value)) return {type: 'Circular', [signature]: signature};
      seen.add(value);
    }

    return value;
  };

const serialize = object => {
  try {
    const result = JSON.stringify(object, replacer());
    if (typeof result == 'string') return result;
  } catch (error) {
    // squelch
  }
  try {
    return JSON.stringify({type: 'String', value: String(object)});
  } catch (error) {
    // squelch
  }
  return JSON.stringify({
    type: 'Problem',
    value: 'cannot convert value to JSON or string',
    [signature]: signature
  });
};

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
    this.stopTest = false;
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
        !event.hasOwnProperty('diffTime') && (event.diffTime = event.time - this.time);
        break;
      case 'end':
        !event.hasOwnProperty('diffTime') && (event.diffTime = event.time - this.startTime);
        break;
    }

    if (
      event.type === 'assert' &&
      (event.operator === 'error' || event.operator === 'exception') &&
      event.data &&
      event.data.actual &&
      typeof event.data.actual.stack == 'string'
    ) {
      const lines = event.data.actual.stack.split('\n');
      event.at = lines[Math.min(2, lines.length) - 1].trim().replace(/^at\s+/i, '');
    }

    if (!event.at && event.marker && typeof event.marker.stack == 'string') {
      const lines = event.marker.stack.split('\n');
      event.at = lines[Math.min(3, lines.length) - 1].trim().replace(/^at\s+/i, '');
    }

    if (event.type === 'assert' && event.data) {
      if (typeof event.expected != 'string' && event.data.hasOwnProperty('expected')) {
        event.expected = serialize(event.data.expected);
      }
      if (typeof event.expected == 'string') delete event.data.expected;
      if (typeof event.actual != 'string' && event.data.hasOwnProperty('actual')) {
        event.actual = serialize(event.data.actual);
      }
      if (typeof event.actual == 'string') delete event.data.actual;
    }

    switch (event.type) {
      case 'assert':
        if (isFailed && this.failOnce && !this.skip) event.stopTest = true;
        break;
      case 'bail-out':
        event.stopTest = true;
        break;
    }

    if (event.stopTest) {
      if (!this.stopTest) {
        for (const state of this) state.skip = state.stopTest = true;
      }
    } else if (this.stopTest) {
      event.stopTest = true;
    }

    this.callback(event);

    switch (event.type) {
      case 'assert':
        if (event.stopTest && event.operator !== 'exception')
          throw new StopTest('failOnce is activated');
        this.time = this.timer.now();
        break;
      case 'bail-out':
        throw new StopTest('bailOut is activated');
    }
  }

  *[Symbol.iterator]() {
    for (let state = this; state; state = state.parent) yield state;
  }
}

export default State;
