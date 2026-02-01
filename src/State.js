import {getTimer} from './utils/timer.js';

export class StopTest extends Error {}

export const signature = 'tape6-!@#$%^&*';

export const isStopTest = error => error instanceof StopTest || error[signature] === signature;

export const isAssertError = error =>
  error.name === 'AssertionError' &&
  error.code === 'ERR_ASSERTION' &&
  typeof error.message == 'string' &&
  typeof error.operator == 'string' &&
  typeof error.generatedMessage == 'boolean';

export const getStackList = error => {
  const stackList = [];
  for (const line of error.stack.split('\n')) {
    const result = /^\s+at\s+(.*)$/.exec(line);
    if (result) stackList.push(result[1].trimEnd());
  }
  return stackList;
};

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

export class State {
  constructor(parent, {name, test, time, skip, todo, failOnce, timer}) {
    this.parent = parent;
    this.name = name || '';
    this.test = test || 0;
    parent = parent || {};
    this.skip = skip || parent.skip;
    this.todo = todo || parent.todo;
    this.failOnce = failOnce || parent.failOnce;
    this.offset = parent.asserts || 0;
    this.asserts = this.skipped = this.failed = 0;
    this.stopTest = false;
    this.timer = timer || parent.timer || getTimer();
    this.startTime = this.time = time || this.timer.now();
    this.abortController = new AbortController();
  }

  get signal() {
    return this.abortController.signal;
  }

  abort() {
    if (this.abortController.signal.aborted) return;
    this.abortController.abort();
  }

  dispose() {
    this.abort();
  }

  updateParent() {
    if (!this.parent) return;
    this.parent.asserts += this.asserts;
    this.parent.skipped += this.skipped;
    this.parent.failed += this.failed;
  }

  preprocess(event) {
    event = {...event, skip: event.skip || this.skip, todo: event.todo || this.todo};
    !event.type && (event.type = 'assert');

    if (typeof event.time !== 'number' || !event.time) {
      event.time = this.timer.now();
      delete event.diffTime;
    }

    if (event.type === 'test') return event;

    const isFailed = event.fail && !event.todo && !event.skip;

    if (event.type === 'assert') {
      ++this.asserts;
      event.skip && ++this.skipped;
      isFailed && ++this.failed;
      event.id = this.asserts + this.offset;
      typeof event.diffTime !== 'number' && (event.diffTime = event.time - this.time);
    } else {
      typeof event.diffTime !== 'number' && (event.diffTime = event.time - this.startTime);
    }

    if (
      event.type === 'assert' &&
      (event.operator === 'error' || event.operator === 'exception') &&
      typeof event.data?.actual?.stack == 'string'
    ) {
      event.stackList = getStackList(event.data.actual);
      event.at = event.stackList[0];
    }

    if (event.type === 'assert-error' && typeof event.data?.error?.stack == 'string') {
      event.stackList = getStackList(event.data.error);
      event.at = event.stackList[0];
    }

    if (!event.at && typeof event.marker?.stack == 'string') {
      event.stackList = getStackList(event.marker);
      event.at =
        event.stackList[
          Math.min(
            typeof event.markerIndex == 'number' ? event.markerIndex : 1,
            event.stackList.length
          )
        ];
    }

    if ((event.type === 'assert' || event.type === 'assert-error') && event.data) {
      if (typeof event.expected != 'string' && event.data.hasOwnProperty('expected')) {
        event.expected = serialize(event.data.expected);
      }
      if (typeof event.expected == 'string') delete event.data.expected;
      if (typeof event.actual != 'string' && event.data.hasOwnProperty('actual')) {
        event.actual = serialize(event.data.actual);
      }
      if (typeof event.actual == 'string') delete event.data.actual;
      if (typeof event.error != 'string' && event.data.hasOwnProperty('error')) {
        event.error = serialize(event.data.error);
      }
      if (typeof event.error == 'string') delete event.data.error;
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

    return event;
  }

  postprocess(event) {
    switch (event.type) {
      case 'assert':
        if (event.stopTest && event.operator !== 'exception') {
          const stopTest = new StopTest('failOnce is activated');
          stopTest[signature] = signature;
          throw stopTest;
        }
        this.time = this.timer.now();
        break;
      case 'bail-out':
        const stopTest = new StopTest('bailOut is activated');
        stopTest[signature] = signature;
        throw stopTest;
    }
  }

  *[Symbol.iterator]() {
    for (let state = this; state; state = state.parent) yield state;
  }
}

export default State;
