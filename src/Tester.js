import {equal, match, any} from './deep6/index.js';

const throwHelper = fn => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
};

class Tester {
  constructor(state, testNumber) {
    this.state = state;
    this.testNumber = testNumber;
  }

  plan(n) {
    this.state.setPlan(n);
  }

  comment(msg) {
    this.state.emit({type: 'comment', name: msg || 'comment', test: this.testNumber, marker: new Error(), time: this.state.timer.now()});
  }

  skip(...args) {
    let msg;
    for (let i = args.length - 1; i >= 0; --i) {
      if (typeof args[i] == 'string') {
        msg = args[i];
        break;
      }
    }
    this.state.emit({
      type: 'skip',
      name: msg || 'skipped test',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      skip: true,
      operator: 'skip'
    });
  }

  bailOut(msg) {
    this.state.emit({
      type: 'bail-out',
      name: msg || 'bail out',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'bailOut'
    });
  }

  // asserts

  pass(msg) {
    this.state.emit({
      name: msg || 'pass',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'pass',
      data: {expected: true, actual: true}
    });
  }

  fail(msg) {
    this.state.emit({
      name: msg || 'fail',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'fail',
      fail: true,
      data: {expected: true, actual: false}
    });
  }

  ok(value, msg) {
    this.state.emit({
      name: msg || 'should be truthy',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'ok',
      fail: !value,
      data: {
        expected: true,
        actual: value
      }
    });
  }

  notOk(value, msg) {
    this.state.emit({
      name: msg || 'should be falsy',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'notOk',
      fail: !!value,
      data: {
        expected: false,
        actual: value
      }
    });
  }

  error(error, msg) {
    this.state.emit({
      name: msg || String(error),
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'error',
      fail: !!error,
      data: {
        expected: true,
        actual: error
      }
    });
  }

  strictEqual(a, b, msg) {
    this.state.emit({
      name: msg || 'should be strictly equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'equal',
      fail: typeof a == 'object' ? a !== b : !equal(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notStrictEqual(a, b, msg) {
    this.state.emit({
      name: msg || 'should not be strictly equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'notEqual',
      fail: typeof a == 'object' ? a === b : equal(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  looseEqual(a, b, msg) {
    this.state.emit({
      name: msg || 'should be loosely equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'looseEqual',
      fail: a != b,
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notLooseEqual(a, b, msg) {
    this.state.emit({
      name: msg || 'should not be loosely equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'notLooseEqual',
      fail: a == b,
      data: {
        expected: b,
        actual: a
      }
    });
  }

  deepEqual(a, b, msg) {
    this.state.emit({
      name: msg || 'should be deeply equivalent',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'deepEqual',
      fail: !equal(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notDeepEqual(a, b, msg) {
    this.state.emit({
      name: msg || 'should not be deeply equivalent',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'notDeepEqual',
      fail: equal(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  deepLooseEqual(a, b, msg) {
    this.state.emit({
      name: msg || 'should be loosely equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'deepLooseEqual',
      fail: !equal(a, b, {circular: true, loose: true}),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notDeepLooseEqual(a, b, msg) {
    this.state.emit({
      name: msg || 'should not be loosely equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'notDeepLooseEqual',
      fail: equal(a, b, {circular: true, loose: true}),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  throws(fn, msg) {
    if (typeof fn != 'function') throw new TypeError('the first argument should be a function');
    const result = throwHelper(fn);
    this.state.emit({
      name: msg || 'should throw',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'throws',
      fail: !result,
      data: {
        expected: null,
        actual: result
      }
    });
  }

  doesNotThrow(fn, msg) {
    if (typeof fn != 'function') throw new TypeError('the first argument should be a function');
    const result = throwHelper(fn);
    this.state.emit({
      name: msg || 'should not throw',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'doesNotThrow',
      fail: !!result,
      data: {
        expected: null,
        actual: result
      }
    });
  }

  matchString(string, regexp, msg) {
    if (typeof string != 'string') throw new TypeError('the first argument should be a string');
    if (!regexp || typeof regexp != 'object' || typeof regexp.test != 'function')
      throw new TypeError('the second argument should be a regular expression object');
    this.state.emit({
      name: msg || 'should match regular expression',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'matchString',
      fail: !regexp.test(string),
      data: {
        expected: regexp,
        actual: string
      }
    });
  }

  doesNotMatchString(string, regexp, msg) {
    if (typeof string != 'string') throw new TypeError('the first argument should be a string');
    if (!regexp || typeof regexp != 'object' || typeof regexp.test != 'function')
      throw new TypeError('the second argument should be a regular expression object');
    this.state.emit({
      name: msg || 'should not match regular expression',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'doesNotMatch',
      fail: regexp.test(string),
      data: {
        expected: regexp,
        actual: string
      }
    });
  }

  match(a, b, msg) {
    this.state.emit({
      name: msg || 'should match object',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'match',
      fail: !match(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  doesNotMatch(a, b, msg) {
    this.state.emit({
      name: msg || 'should not match object',
      test: this.testNumber,
      marker: new Error(),
      time: this.state.timer.now(),
      operator: 'doesNotMatchObject',
      fail: match(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  rejects(promise, msg) {
    if (!promise || typeof promise.then != 'function') throw new TypeError('the first argument should be a promise');
    return promise
      .then(
        () => null,
        error => error
      )
      .then(result => {
        this.state.emit({
          name: msg || 'should be rejected',
          test: this.testNumber,
          marker: new Error(),
          time: this.state.timer.now(),
          operator: 'rejects',
          fail: !result,
          data: {
            expected: null,
            actual: result
          }
        });
      });
  }

  resolves(promise, msg) {
    if (!promise || typeof promise.then != 'function') throw new TypeError('the first argument should be a promise');
    return promise
      .then(
        () => null,
        error => error
      )
      .then(result => {
        this.state.emit({
          name: msg || 'should not be rejected',
          test: this.testNumber,
          marker: new Error(),
          time: this.state.timer.now(),
          operator: 'resolves',
          fail: !!result,
          data: {
            expected: null,
            actual: result
          }
        });
      });
  }

  // missing: T (eval)
}
Tester.prototype.any = Tester.prototype._ = any;

const setAliases = (source, aliases) => aliases.split(', ').forEach(alias => (Tester.prototype[alias] = Tester.prototype[source]));

setAliases('ok', 'true, assert');
setAliases('notOk', 'false, notok');
setAliases('error', 'ifError, ifErr, iferror');
setAliases('strictEqual', 'is, equal, equals, isEqual, strictEquals');
setAliases('notStrictEqual', 'not, notEqual, notEquals, isNotEqual, doesNotEqual, isInequal, notStrictEquals, isNot');
setAliases('looseEqual', 'looseEquals');
setAliases('notLooseEqual', 'notLooseEquals');
setAliases('deepEqual', 'same, deepEquals, isEquivalent');
setAliases('notDeepEqual', 'notSame, notDeepEquals, notEquivalent, notDeeply, isNotDeepEqual, isNotDeepEqual, isNotEquivalent, isInequivalent');
setAliases('rejects', 'doesNotResolve');
setAliases('resolves', 'doesNotReject');

// test() (an embedded test runner) is added in ./test.js to avoid circular dependencies

export default Tester;
