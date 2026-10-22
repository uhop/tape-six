import test from '../index.js';
import {Tester} from '../src/Tester.js';

class SpyReporter {
  constructor() {
    this.reports = [];
    this.timer = {now: () => 0};
  }
  report(event) {
    this.reports.push(event);
  }
}

const verdicts = run => {
  const reporter = new SpyReporter();
  run(new Tester(0, reporter));
  return reporter.reports.map(r => !!r.fail);
};

test('pass always passes, fail always fails', t => {
  t.deepEqual(
    verdicts(sub => {
      sub.pass();
      sub.fail();
    }),
    [false, true]
  );
});

test('ok and notOk follow truthiness', t => {
  t.deepEqual(
    verdicts(sub => {
      sub.ok(1);
      sub.ok('x');
      sub.ok({});
      sub.ok(0);
      sub.ok('');
      sub.ok(null);
      sub.ok(undefined);
      sub.ok(NaN);
    }),
    [false, false, false, true, true, true, true, true]
  );
  t.deepEqual(
    verdicts(sub => {
      sub.notOk(0);
      sub.notOk('');
      sub.notOk(null);
      sub.notOk(1);
      sub.notOk('x');
      sub.notOk({});
    }),
    [false, false, false, true, true, true]
  );
});

test('error fails on any truthy value', t => {
  t.deepEqual(
    verdicts(sub => {
      sub.error(null);
      sub.error(undefined);
      sub.error(new Error('x'));
      sub.error('x');
      sub.error({code: 'E'});
    }),
    [false, false, true, true, true]
  );
});

test('strictEqual compares primitives strictly and objects by identity', t => {
  const object = {};
  t.deepEqual(
    verdicts(sub => {
      sub.strictEqual(1, 1);
      sub.strictEqual(object, object);
      sub.strictEqual(1, '1');
      sub.strictEqual({}, {});
    }),
    [false, false, true, true]
  );
  t.deepEqual(
    verdicts(sub => {
      sub.notStrictEqual(1, '1');
      sub.notStrictEqual({}, {});
      sub.notStrictEqual(1, 1);
      sub.notStrictEqual(object, object);
    }),
    [false, false, true, true]
  );
});

test('looseEqual and notLooseEqual use ==', t => {
  t.deepEqual(
    verdicts(sub => {
      sub.looseEqual(1, '1');
      sub.looseEqual(null, undefined);
      sub.looseEqual(1, 2);
      sub.notLooseEqual(1, 2);
      sub.notLooseEqual(1, '1');
    }),
    [false, false, true, false, true]
  );
});

test('deepEqual is strict, deepLooseEqual is loose', t => {
  t.deepEqual(
    verdicts(sub => {
      sub.deepEqual({a: [1, {b: 2}]}, {a: [1, {b: 2}]});
      sub.deepEqual([1], ['1']);
      sub.deepEqual({a: 1}, {a: 1, b: 2});
      sub.notDeepEqual([1], ['1']);
      sub.notDeepEqual([1], [1]);
    }),
    [false, true, true, false, true]
  );
  t.deepEqual(
    verdicts(sub => {
      sub.deepLooseEqual([1], ['1']);
      sub.deepLooseEqual([1], [2]);
      sub.notDeepLooseEqual([1], [2]);
      sub.notDeepLooseEqual([1], ['1']);
    }),
    [false, true, false, true]
  );
});

test('matchString and doesNotMatchString test the string against the RegExp', t => {
  t.deepEqual(
    verdicts(sub => {
      sub.matchString('abc', /b/);
      sub.matchString('abc', /^b$/);
      sub.doesNotMatchString('abc', /x/);
      sub.doesNotMatchString('abc', /b/);
    }),
    [false, true, false, true]
  );
});

test('doesNotMatch fails when the pattern matches', t => {
  t.deepEqual(
    verdicts(sub => {
      sub.doesNotMatch({a: 1}, {a: 2});
      sub.doesNotMatch({a: 1, b: 2}, {a: 1});
    }),
    [false, true]
  );
});
