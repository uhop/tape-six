import test, {getTester} from '../index.js';
import {Tester} from '../src/Tester.js';

const HOST = Symbol.for('tape6.invariant.host.v1');

const capture = () => {
  let last = null;
  return {
    reporter: {report: r => (last = r), timer: {now: () => 0}},
    get last() {
      return last;
    }
  };
};

test('reportAssertion: assert-shaped report for a plain verdict', t => {
  const c = capture(),
    sub = new Tester(7, c.reporter),
    marker = new Error('call site');
  sub.reportAssertion({ok: true, message: 'inv ok', marker});
  t.equal(c.last.operator, 'ok', 'defaults to the ok operator');
  t.notOk(c.last.fail, 'truthy verdict does not fail');
  t.equal(c.last.data.expected, true);
  t.equal(c.last.data.actual, true);
  t.equal(c.last.marker, marker, 'uses the provided marker verbatim');
  t.equal(c.last.test, 7, 'reports under the tester number');
  t.equal(c.last.name, 'inv ok');
});

test('reportAssertion: falsy verdict fails; missing marker is fabricated', t => {
  const c = capture(),
    sub = new Tester(0, c.reporter);
  sub.reportAssertion({ok: 0});
  t.ok(c.last.fail, 'falsy verdict fails');
  t.equal(c.last.data.actual, 0, 'verdict becomes actual when no info given');
  t.ok(c.last.marker instanceof Error, 'fabricates a marker when none supplied');
  t.equal(c.last.name, 'invariant', 'default name');
});

test('reportAssertion: info carries operator/expected/actual', t => {
  const c = capture(),
    sub = new Tester(0, c.reporter);
  sub.reportAssertion({ok: false, operator: 'equal', expected: 2, actual: 3, message: 'eq'});
  t.equal(c.last.operator, 'equal');
  t.equal(c.last.data.expected, 2);
  t.equal(c.last.data.actual, 3);
  t.ok(c.last.fail);
});

test('invariant host slot is installed and routes to the current tester', t => {
  const host = globalThis[HOST];
  t.ok(host, 'host slot present after importing tape-six');
  t.equal(host.version, 1);
  t.equal(typeof host.report, 'function');
  t.equal(getTester(), t, 'getTester() returns the active tester inside a test');
  t.doesNotThrow(() => host.report({ok: true, message: 'routed via host'}));
});
