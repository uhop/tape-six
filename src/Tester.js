import unify from 'heya-unify';
import preprocess from 'heya-unify/utils/preprocess.js';

const stateKey = Symbol.for('state'),
  testKey = Symbol.for('test');

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
    this[stateKey] = state;
    this[testKey] = testNumber;
  }

  plan(n) {
    this[stateKey].setPlan(n);
  }

  comment(msg) {
    this[stateKey].emit({type: 'comment', name: msg || 'comment', test: this[testKey], marker: new Error(), time: this[stateKey].timer.now()});
  }

  // asserts

  pass(msg) {
    this[stateKey].emit({
      name: msg || 'pass',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'pass',
      data: {expected: true, actual: true}
    });
  }

  fail(msg) {
    this[stateKey].emit({
      name: msg || 'fail',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'fail',
      fail: true,
      data: {expected: true, actual: false}
    });
  }

  skip(msg) {
    this[stateKey].emit({
      name: msg || 'skip',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'skip',
      skip: true,
      data: {expected: true, actual: true}
    });
  }

  ok(value, msg) {
    this[stateKey].emit({
      name: msg || 'should be truthy',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'ok',
      fail: !value,
      data: {
        expected: true,
        actual: value
      }
    });
  }

  notOk(value, msg) {
    this[stateKey].emit({
      name: msg || 'should be falsy',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'notOk',
      fail: !!value,
      data: {
        expected: false,
        actual: value
      }
    });
  }

  error(error, msg) {
    this[stateKey].emit({
      name: msg || String(error),
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'error',
      fail: !!error,
      data: {
        expected: true,
        actual: error
      }
    });
  }

  strictEqual(a, b, msg) {
    this[stateKey].emit({
      name: msg || 'should be strictly equal',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'equal',
      fail: typeof a == 'object' ? a !== b : !unify(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notStrictEqual(a, b, msg) {
    this[stateKey].emit({
      name: msg || 'should not be strictly equal',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'notEqual',
      fail: typeof a == 'object' ? a === b : unify(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  looseEqual(a, b, msg) {
    this[stateKey].emit({
      name: msg || 'should be loosely equal',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'looseEqual',
      fail: a != b,
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notLooseEqual(a, b, msg) {
    this[stateKey].emit({
      name: msg || 'should not be loosely equal',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'notLooseEqual',
      fail: a == b,
      data: {
        expected: b,
        actual: a
      }
    });
  }

  deepEqual(a, b, msg) {
    this[stateKey].emit({
      name: msg || 'should be deeply equivalent',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'deepEqual',
      fail: !unify(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notDeepEqual(a, b, msg) {
    this[stateKey].emit({
      name: msg || 'should not be deeply equivalent',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'notDeepEqual',
      fail: unify(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  throws(fn, msg) {
    if (typeof fn != 'function') throw new TypeError('the first argument should be a function');
    const result = throwHelper(fn);
    this[stateKey].emit({
      name: msg || 'should throw',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
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
    this[stateKey].emit({
      name: msg || 'should not throw',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'doesNotThrow',
      fail: !!result,
      data: {
        expected: null,
        actual: result
      }
    });
  }

  match(string, regexp, msg) {
    if (typeof string != 'string') throw new TypeError('the first argument should be a string');
    if (!regexp || typeof regexp != 'object' || typeof regexp.test != 'function')
      throw new TypeError('the second argument should be a regular expression object');
    this[stateKey].emit({
      name: msg || 'should match regular expression',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'match',
      fail: !regexp.test(string),
      data: {
        expected: regexp,
        actual: string
      }
    });
  }

  doesNotMatch(string, regexp, msg) {
    if (typeof string != 'string') throw new TypeError('the first argument should be a string');
    if (!regexp || typeof regexp != 'object' || typeof regexp.test != 'function')
      throw new TypeError('the second argument should be a regular expression object');
    this[stateKey].emit({
      name: msg || 'should not match regular expression',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'doesNotMatch',
      fail: !!regexp.test(string),
      data: {
        expected: regexp,
        actual: string
      }
    });
  }

  matchObject(a, b, msg) {
    this[stateKey].emit({
      name: msg || 'should match object',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'matchObject',
      fail: !unify(a, preprocess(b, true)),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  doesNotMatchObject(a, b, msg) {
    this[stateKey].emit({
      name: msg || 'should not match object',
      test: this[testKey],
      marker: new Error(),
      time: this[stateKey].timer.now(),
      operator: 'doesNotMatchObject',
      fail: !!unify(a, preprocess(b, true)),
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
        this[stateKey].emit({
          name: msg || 'should be rejected',
          test: this[testKey],
          marker: new Error(),
          time: this[stateKey].timer.now(),
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
        this[stateKey].emit({
          name: msg || 'should not be rejected',
          test: this[testKey],
          marker: new Error(),
          time: this[stateKey].timer.now(),
          operator: 'resolves',
          fail: !!result,
          data: {
            expected: null,
            actual: result
          }
        });
      });
  }

  // missing:
  // deepLooseEqual()
  // notDeepLooseEqual()
}
Tester.prototype.unify = unify;

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

// TODO: add missing aliases and compound methods

export default Tester;
