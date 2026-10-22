import test from '../index.js';
import {Tester} from '../src/Tester.js';
import matchInstanceOf from '../src/deep6/unifiers/matchInstanceOf.js';

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
      throw {code: 'ENOENT', errno: -2};
    },
    {code: 'ENOENT'}
  );
  sub.throws(
    () => {
      throw {code: 'OTHER'};
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
  await sub.rejects(Promise.reject({code: 'ENOENT'}), {code: 'ENOENT'});
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

test('object patterns do not match class instances; matchInstanceOf does', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  class Response {
    constructor(status) {
      this.status = status;
    }
  }
  sub.throws(
    () => {
      throw new CustomError('boom', 'ENOENT');
    },
    {code: 'ENOENT'}
  );
  sub.match(new Response(200), {status: 200});
  sub.doesNotMatch(new Date(), {});
  sub.match(new Response(200), new Response(200));
  sub.match(new Response(200), matchInstanceOf(Response));
  sub.match({response: new Response(200)}, {response: matchInstanceOf(Response)});
  t.deepEqual(verdicts(reporter), [true, true, false, false, false, false]);
});

test('t.throws: a function that throws nothing fails, with or without a matcher', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.throws(() => {});
  sub.throws(() => {}, TypeError);
  sub.throws(() => {}, {code: 'ENOENT'});
  t.deepEqual(verdicts(reporter), [true, true, true]);
});

test('matchers: truthy predicates, RegExp on an Error message, strict primitives', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.throws(
    () => {
      throw 1;
    },
    value => value
  );
  sub.throws(() => {
    throw new Error('not found');
  }, /^not found$/);
  sub.throws(() => {
    throw 0;
  }, 0);
  sub.throws(() => {
    throw 0;
  }, false);
  t.deepEqual(verdicts(reporter), [false, false, false, true]);
});

test('throws, rejects, and resolves return the value they caught', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  const thrown = {code: 'E'},
    reason = new Error('x');
  t.equal(
    sub.throws(() => {
      throw thrown;
    }),
    thrown
  );
  t.equal(
    sub.throws(() => {}),
    undefined
  );
  t.equal(await sub.rejects(Promise.reject(reason)), reason);
  t.equal(await sub.rejects(Promise.resolve(1)), undefined);
  t.equal(await sub.resolves(Promise.resolve(42)), 42);
  t.equal(await sub.resolves(Promise.reject(reason)), undefined);
  t.deepEqual(verdicts(reporter), [false, true, false, true, false, true]);
});

test('object patterns require every key they name', t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  sub.match({code: 'x', other: 1}, {code: 'x'});
  sub.match({}, {code: 'x'});
  sub.match({recordId: 'x'}, {refused: 'claimed_by_other'});
  sub.match({a: {}}, {a: {b: 1}});
  sub.doesNotMatch({}, {code: 'x'});
  sub.throws(
    () => {
      throw {message: 'x'};
    },
    {code: 'ENOENT'}
  );
  t.deepEqual(verdicts(reporter), [false, true, true, true, false, true]);
});
