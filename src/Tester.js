import {equal, match, any} from './deep6/index.js';
import unify from './deep6/unify.js';
import {getTimer} from './utils/timer.js';

const tryFn = fn => {
  try {
    fn();
    return {threw: false};
  } catch (error) {
    return {threw: true, error};
  }
};

const isErrorClass = fn =>
  fn === Error || (typeof fn === 'function' && fn.prototype instanceof Error);

// tape-six compares by value, not by strict structure: circular: true picks
// deep6's cheapest value-preserving mode (bisimulation); 'graph' is out.
const equalOptions = {circular: true};
const looseEqualOptions = {circular: true, loose: true};

// matchers: open-mode unify on the naked pattern (deep6 1.4.0+) has no
// prototype guard, so plain patterns match class instances by their own
// properties — an absent key constrains nothing. match() would
// preprocess-wrap the pattern, which forbids instance targets.
const matchOptions = {
  openObjects: true,
  openArrays: true,
  openMaps: true,
  openSets: true,
  circular: true
};
const matchValues = (value, pattern) => !!unify(value, pattern, null, matchOptions);

const applyMatcher = (actual, matcher) => {
  if (matcher === undefined) return true;
  if (typeof matcher === 'function') {
    if (isErrorClass(matcher)) return actual instanceof matcher;
    return !!matcher(actual);
  }
  if (matcher instanceof RegExp) {
    const str = actual instanceof Error ? actual.message : String(actual);
    return matcher.test(str);
  }
  if (matcher !== null && typeof matcher === 'object') return matchValues(actual, matcher);
  return actual === matcher;
};

export class Tester {
  constructor(testNumber, reporter) {
    this.testNumber = testNumber;
    this.reporter = reporter;
    this.timer = reporter.timer || getTimer();
    this.lastEmbeddedTest = null;
  }

  async dispose() {
    this.reporter.abort();
    await this.lastEmbeddedTest;
  }

  get signal() {
    return this.reporter.signal;
  }

  get state() {
    return this.reporter.state;
  }

  plan(n) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0)
      throw new TypeError('plan(n) requires a non-negative integer');
    this.planned = n;
  }

  comment(msg) {
    this.reporter.report({
      type: 'comment',
      name: msg || 'comment',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now()
    });
  }

  skipTest(...args) {
    let msg;
    for (let i = args.length - 1; i >= 0; --i) {
      if (typeof args[i] == 'string') {
        msg = args[i];
        break;
      }
    }
    this.reporter.report({
      name: msg || 'skipped test',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      skip: true,
      operator: 'skip'
    });
  }

  bailOut(msg) {
    this.reporter.report({
      type: 'bail-out',
      name: msg || 'bail out',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'bailOut'
    });
  }

  pass(msg) {
    this.reporter.report({
      name: msg || 'pass',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'pass',
      data: {expected: true, actual: true}
    });
  }

  fail(msg) {
    this.reporter.report({
      name: msg || 'fail',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'fail',
      fail: true,
      data: {expected: true, actual: false}
    });
  }

  ok(value, msg) {
    this.reporter.report({
      name: msg || 'should be truthy',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'ok',
      fail: !value,
      data: {
        expected: true,
        actual: value
      }
    });
  }

  reportAssertion(assertion) {
    const {ok, message, marker, operator, expected, actual} = assertion || {};
    const hasData = expected !== undefined || actual !== undefined;
    this.reporter.report({
      name: message || 'invariant',
      test: this.testNumber,
      marker: marker instanceof Error ? marker : new Error(),
      time: this.timer.now(),
      operator: operator || 'ok',
      fail: !ok,
      data: hasData ? {expected, actual} : {expected: true, actual: ok}
    });
  }

  notOk(value, msg) {
    this.reporter.report({
      name: msg || 'should be falsy',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'notOk',
      fail: !!value,
      data: {
        expected: false,
        actual: value
      }
    });
  }

  error(error, msg) {
    this.reporter.report({
      name: msg || String(error),
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'error',
      fail: !!error,
      data: {
        expected: true,
        actual: error
      }
    });
  }

  strictEqual(a, b, msg) {
    this.reporter.report({
      name: msg || 'should be strictly equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'equal',
      fail: typeof a == 'object' ? a !== b : !equal(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notStrictEqual(a, b, msg) {
    this.reporter.report({
      name: msg || 'should not be strictly equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'notEqual',
      fail: typeof a == 'object' ? a === b : equal(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  looseEqual(a, b, msg) {
    this.reporter.report({
      name: msg || 'should be loosely equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'looseEqual',
      fail: a != b,
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notLooseEqual(a, b, msg) {
    this.reporter.report({
      name: msg || 'should not be loosely equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'notLooseEqual',
      fail: a == b,
      data: {
        expected: b,
        actual: a
      }
    });
  }

  deepEqual(a, b, msg) {
    this.reporter.report({
      name: msg || 'should be deeply equivalent',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'deepEqual',
      fail: !equal(a, b, equalOptions),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notDeepEqual(a, b, msg) {
    this.reporter.report({
      name: msg || 'should not be deeply equivalent',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'notDeepEqual',
      fail: equal(a, b, equalOptions),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  deepLooseEqual(a, b, msg) {
    this.reporter.report({
      name: msg || 'should be deeply loosely equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'deepLooseEqual',
      fail: !equal(a, b, looseEqualOptions),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  notDeepLooseEqual(a, b, msg) {
    this.reporter.report({
      name: msg || 'should not be deeply loosely equal',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'notDeepLooseEqual',
      fail: equal(a, b, looseEqualOptions),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  throws(fn, matcher, msg) {
    if (typeof fn != 'function') throw new TypeError('the first argument should be a function');
    if (typeof matcher === 'string' && msg === undefined) {
      msg = matcher;
      matcher = undefined;
    }
    const {threw, error} = tryFn(fn);
    const matched = threw && applyMatcher(error, matcher);
    this.reporter.report({
      name: msg || 'should throw',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'throws',
      fail: !matched,
      data: {
        expected: matcher === undefined ? null : matcher,
        actual: threw ? error : null
      }
    });
  }

  doesNotThrow(fn, msg) {
    if (typeof fn != 'function') throw new TypeError('the first argument should be a function');
    const {threw, error} = tryFn(fn);
    this.reporter.report({
      name: msg || 'should not throw',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'doesNotThrow',
      fail: threw,
      data: {
        expected: null,
        actual: threw ? error : null
      }
    });
  }

  matchString(string, regexp, msg) {
    if (typeof string != 'string') throw new TypeError('the first argument should be a string');
    if (!regexp || typeof regexp != 'object' || typeof regexp.test != 'function')
      throw new TypeError('the second argument should be a regular expression object');
    this.reporter.report({
      name: msg || 'should match regular expression',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
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
    this.reporter.report({
      name: msg || 'should not match regular expression',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'doesNotMatchString',
      fail: regexp.test(string),
      data: {
        expected: regexp,
        actual: string
      }
    });
  }

  match(a, b, msg) {
    this.reporter.report({
      name: msg || 'should match object',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'match',
      fail: !matchValues(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  doesNotMatch(a, b, msg) {
    this.reporter.report({
      name: msg || 'should not match object',
      test: this.testNumber,
      marker: new Error(),
      time: this.timer.now(),
      operator: 'doesNotMatch',
      fail: matchValues(a, b),
      data: {
        expected: b,
        actual: a
      }
    });
  }

  rejects(promise, matcher, msg) {
    if (!promise || typeof promise.then != 'function')
      throw new TypeError('the first argument should be a promise');
    if (typeof matcher === 'string' && msg === undefined) {
      msg = matcher;
      matcher = undefined;
    }
    return promise
      .then(
        () => ({resolved: true}),
        error => ({resolved: false, error})
      )
      .then(({resolved, error}) => {
        const matched = !resolved && applyMatcher(error, matcher);
        this.reporter.report({
          name: msg || 'should be rejected',
          test: this.testNumber,
          marker: new Error(),
          time: this.timer.now(),
          operator: 'rejects',
          fail: !matched,
          data: {
            expected: matcher === undefined ? null : matcher,
            actual: resolved ? null : error
          }
        });
      });
  }

  resolves(promise, matcher, msg) {
    if (!promise || typeof promise.then != 'function')
      throw new TypeError('the first argument should be a promise');
    if (typeof matcher === 'string' && msg === undefined) {
      msg = matcher;
      matcher = undefined;
    }
    return promise
      .then(
        value => ({resolved: true, value}),
        error => ({resolved: false, error})
      )
      .then(({resolved, value, error}) => {
        const matched = resolved && applyMatcher(value, matcher);
        this.reporter.report({
          name: msg || 'should not be rejected',
          test: this.testNumber,
          marker: new Error(),
          time: this.timer.now(),
          operator: 'resolves',
          fail: !matched,
          data: {
            expected: matcher === undefined ? null : matcher,
            actual: resolved ? (matcher === undefined ? null : value) : error
          }
        });
      });
  }
}
Tester.prototype.any = Tester.prototype._ = any;

// plugin extension point — a same-name collision must fail loudly, not silently override
export const registerTesterMethod = (name, fn) => {
  if (typeof name !== 'string' || !name)
    throw new TypeError('registerTesterMethod: name must be a non-empty string');
  if (typeof fn !== 'function') throw new TypeError('registerTesterMethod: fn must be a function');
  if (Object.prototype.hasOwnProperty.call(Tester.prototype, name)) {
    if (Tester.prototype[name] !== fn)
      throw new Error(
        `registerTesterMethod: '${name}' is already registered with a different implementation`
      );
    return;
  }
  Tester.prototype[name] = fn;
};

export const setAliases = (source, aliases) => {
  const fn = Tester.prototype[source];
  aliases.split(', ').forEach(alias => registerTesterMethod(alias, fn));
};

setAliases('ok', 'true, assert');
setAliases('notOk', 'false, notok');
setAliases('error', 'ifError, ifErr, iferror');
setAliases('strictEqual', 'is, equal, equals, isEqual, strictEquals');
setAliases(
  'notStrictEqual',
  'not, notEqual, notEquals, isNotEqual, doesNotEqual, isUnequal, notStrictEquals, isNot'
);
setAliases('looseEqual', 'looseEquals');
setAliases('notLooseEqual', 'notLooseEquals');
setAliases('deepEqual', 'same, deepEquals, isEquivalent');
setAliases(
  'notDeepEqual',
  'notSame, notDeepEquals, notEquivalent, notDeeply, isNotDeepEqual, isNotEquivalent'
);
setAliases('rejects', 'doesNotResolve');
setAliases('resolves', 'doesNotReject');

// test() (an embedded test runner) is added in ./test.js to avoid circular dependencies

export default Tester;
