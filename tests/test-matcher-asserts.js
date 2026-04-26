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

const verdicts = reporter => reporter.reports.map(r => !!r.fail);

class CustomError extends Error {
  constructor(msg, code) {
    super(msg);
    this.name = 'CustomError';
    this.code = code;
  }
}

test('t.throws: matcher — Error subclass', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.throws(() => {
    throw new TypeError('bad type');
  }, TypeError);
  sub.throws(() => {
    throw new RangeError('out');
  }, TypeError); // wrong class → fail
  sub.throws(() => {
    throw new CustomError('custom', 'X');
  }, Error); // any Error → pass
  t.deepEqual(verdicts(reporter), [false, true, false]);
});

test('t.throws: matcher — RegExp against error.message', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.throws(() => {
    throw new Error('not found');
  }, /not found/);
  sub.throws(() => {
    throw new Error('something else');
  }, /not found/); // miss → fail
  sub.throws(() => {
    throw 'plain string'; // non-Error → matched against String(value)
  }, /plain/);
  t.deepEqual(verdicts(reporter), [false, true, false]);
});

test('t.throws: matcher — predicate function', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.throws(
    () => {
      throw new CustomError('boom', 'ENOENT');
    },
    e => e.code === 'ENOENT'
  );
  sub.throws(
    () => {
      throw new CustomError('boom', 'OTHER');
    },
    e => e.code === 'ENOENT'
  ); // miss → fail
  t.deepEqual(verdicts(reporter), [false, true]);
});

test('t.throws: matcher — object pattern (deep6 match)', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.throws(
    () => {
      throw new CustomError('boom', 'ENOENT');
    },
    {code: 'ENOENT'}
  );
  sub.throws(
    () => {
      throw new CustomError('boom', 'OTHER');
    },
    {code: 'ENOENT'}
  ); // miss → fail
  t.deepEqual(verdicts(reporter), [false, true]);
});

test('t.throws: backward compat — string second arg is the message', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.throws(() => {
    throw new Error('boom');
  }, 'should throw boom'); // 2nd arg is msg
  t.equal(reporter.reports[0].fail, false);
  t.equal(reporter.reports[0].name, 'should throw boom');
});

test('t.throws: falsy throw is detected (regression for tryFn vs throwHelper)', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.throws(() => {
    throw null;
  }, 'throws null is still a throw');
  sub.throws(() => {
    throw 0;
  });
  sub.throws(() => {
    throw false;
  });
  sub.throws(() => {
    throw undefined;
  });
  t.deepEqual(verdicts(reporter), [false, false, false, false]);
});

test('t.doesNotThrow: falsy throw is detected as a throw (no silent pass)', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.doesNotThrow(() => {
    throw null;
  });
  sub.doesNotThrow(() => {
    throw 0;
  });
  sub.doesNotThrow(() => {}); // genuinely doesn't throw
  t.deepEqual(verdicts(reporter), [true, true, false]);
});

test('t.rejects: matcher — Error subclass', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  await sub.rejects(Promise.reject(new TypeError('x')), TypeError);
  await sub.rejects(Promise.reject(new RangeError('x')), TypeError); // miss → fail
  t.deepEqual(verdicts(reporter), [false, true]);
});

test('t.rejects: matcher — RegExp / predicate / object pattern', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  await sub.rejects(Promise.reject(new Error('not found')), /not found/);
  await sub.rejects(Promise.reject(new CustomError('x', 'ENOENT')), e => e.code === 'ENOENT');
  await sub.rejects(Promise.reject(new CustomError('x', 'ENOENT')), {code: 'ENOENT'});
  t.deepEqual(verdicts(reporter), [false, false, false]);
});

test('t.rejects: backward compat — string is message; behavior unchanged without matcher', async t => {
  // Just calls through the public API; if it stays passing, backward compat holds.
  await t.rejects(Promise.reject(new Error('x')), 'msg variant 1');
  await t.rejects(Promise.reject(new Error('x'))); // no msg, no matcher
});

test('t.resolves: matcher — strict equality on resolved value', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  await sub.resolves(Promise.resolve(42), 42);
  await sub.resolves(Promise.resolve(42), 43); // miss → fail
  await sub.resolves(Promise.resolve(null), null);
  t.deepEqual(verdicts(reporter), [false, true, false]);
});

test('t.resolves: matcher — predicate / object pattern', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  await sub.resolves(Promise.resolve({status: 200, body: 'ok'}), v => v.status === 200);
  await sub.resolves(Promise.resolve({status: 200, body: 'ok'}), {status: 200});
  await sub.resolves(Promise.resolve({status: 404}), {status: 200}); // miss → fail
  t.deepEqual(verdicts(reporter), [false, false, true]);
});

test('t.resolves: rejected promise reports actual=error in data', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  const err = new Error('boom');
  await sub.resolves(Promise.reject(err), v => v === 42);
  t.equal(reporter.reports[0].fail, true);
  t.equal(reporter.reports[0].data.actual, err);
});

test('t.resolves: backward compat — string is message; no value reported when no matcher', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  await sub.resolves(Promise.resolve(42), 'msg variant');
  t.equal(reporter.reports[0].fail, false);
  t.equal(reporter.reports[0].name, 'msg variant');
  t.equal(reporter.reports[0].data.actual, null, 'actual stays null with no matcher');
});

test('matcher edge cases', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  // Predicate that returns falsy for the value → fail.
  sub.throws(
    () => {
      throw new Error('x');
    },
    () => false
  );
  // Predicate vs Error class disambiguation: arrow fns are not Error classes.
  sub.throws(
    () => {
      throw new Error('x');
    },
    e => e instanceof Error
  );
  t.deepEqual(verdicts(reporter), [true, false]);
});
