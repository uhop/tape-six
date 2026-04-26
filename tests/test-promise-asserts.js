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

const lastVerdict = reporter => {
  const r = reporter.reports[reporter.reports.length - 1];
  return {fail: !!r.fail, actual: r.data && r.data.actual, operator: r.operator};
};

test('t.rejects: every rejection (including falsy reasons) is a pass', async t => {
  await t.rejects(Promise.reject(new Error('boom')), 'rejected with Error');
  await t.rejects(Promise.reject(null), 'rejected with null');
  await t.rejects(Promise.reject(undefined), 'rejected with undefined');
  await t.rejects(Promise.reject(0), 'rejected with 0');
  await t.rejects(Promise.reject(false), 'rejected with false');
  await t.rejects(Promise.reject(''), 'rejected with empty string');
  await t.rejects(Promise.reject(NaN), 'rejected with NaN');
});

test('t.resolves: any resolution is a pass', async t => {
  await t.resolves(Promise.resolve(42), 'resolved with 42');
  await t.resolves(Promise.resolve(null), 'resolved with null');
  await t.resolves(Promise.resolve(undefined), 'resolved with undefined');
  await t.resolves(Promise.resolve(0), 'resolved with 0');
  await t.resolves(Promise.resolve(false), 'resolved with false');
});

test('t.rejects: a resolved promise is a failure (verdict via spy reporter)', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);
  await sub.rejects(Promise.resolve(42));
  const v = lastVerdict(reporter);
  t.ok(v.fail, 'rejects(Promise.resolve(...)) reports a failure');
  t.equal(v.actual, null, 'data.actual is null when promise resolved');
  t.equal(v.operator, 'rejects', 'operator is "rejects"');
});

test('t.resolves: a rejected promise is a failure even with falsy reason (no silent pass)', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);

  await sub.resolves(Promise.reject(null));
  await sub.resolves(Promise.reject(undefined));
  await sub.resolves(Promise.reject(0));
  await sub.resolves(Promise.reject(false));
  await sub.resolves(Promise.reject(''));
  await sub.resolves(Promise.reject(NaN));
  await sub.resolves(Promise.reject(new Error('boom')));

  for (const r of reporter.reports) {
    t.ok(r.fail, `resolves rejected with ${String(r.data.actual)} → fail`);
    t.equal(r.operator, 'resolves', 'operator is "resolves"');
  }
});

test('t.rejects: rejection reason is preserved in data.actual', async t => {
  const reporter = new SpyReporter();
  const sub = new Tester(0, reporter);

  const err = new Error('specific');
  await sub.rejects(Promise.reject(err));
  t.equal(reporter.reports[0].data.actual, err, 'Error object preserved');

  await sub.rejects(Promise.reject('string reason'));
  t.equal(reporter.reports[1].data.actual, 'string reason', 'string preserved');

  await sub.rejects(Promise.reject(null));
  t.equal(reporter.reports[2].data.actual, null, 'null preserved');
});

test('t.rejects/resolves: throw TypeError when not given a thenable', t => {
  t.throws(() => t.rejects(null), 'rejects(null) throws');
  t.throws(() => t.rejects(42), 'rejects(42) throws');
  t.throws(() => t.resolves(null), 'resolves(null) throws');
  t.throws(() => t.resolves('x'), 'resolves(string) throws');
});

test('doesNotResolve / doesNotReject aliases work the same', async t => {
  await t.doesNotResolve(Promise.reject(new Error('boom')));
  await t.doesNotResolve(Promise.reject(null));
  await t.doesNotReject(Promise.resolve(42));
  await t.doesNotReject(Promise.resolve(null));
});
