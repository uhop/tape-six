import test from '../index.js';
import {Tester} from '../src/Tester.js';
import {State} from '../src/State.js';

const fakeTimer = {now: () => 0};

class SpyReporter {
  constructor() {
    this.reports = [];
    this.timer = fakeTimer;
  }
  report(event) {
    this.reports.push(event);
  }
}

// --- State.localAsserts ---

test('State.localAsserts: starts at 0', t => {
  const s = new State(null, {name: 'x', timer: fakeTimer});
  t.equal(s.localAsserts, 0);
});

test('State.localAsserts: increments on assert events', t => {
  const s = new State(null, {name: 'x', timer: fakeTimer});
  s.preprocess({type: 'assert', name: 'a', data: {}});
  s.preprocess({type: 'assert', name: 'b', data: {}});
  s.preprocess({type: 'assertion-error', name: 'c', data: {}});
  t.equal(s.localAsserts, 3);
  t.equal(s.asserts, 3);
});

test('State.localAsserts: ignores non-assert events', t => {
  const s = new State(null, {name: 'x', timer: fakeTimer});
  s.preprocess({type: 'comment', name: 'note'});
  s.preprocess({type: 'test', name: 'sub'});
  t.equal(s.localAsserts, 0);
});

test('State.localAsserts: not propagated to parent on updateParent', t => {
  const parent = new State(null, {name: 'p', timer: fakeTimer});
  const child = new State(parent, {name: 'c', timer: fakeTimer});
  child.preprocess({type: 'assert', name: 'a', data: {}});
  child.preprocess({type: 'assert', name: 'b', data: {}});
  child.updateParent();
  // child contributes to parent.asserts but NOT parent.localAsserts
  t.equal(parent.asserts, 2);
  t.equal(parent.localAsserts, 0);
  t.equal(child.localAsserts, 2);
});

// --- Tester.plan ---

test('Tester.plan: stores value', t => {
  const sub = new Tester(0, new SpyReporter());
  t.equal(sub.planned, undefined);
  sub.plan(5);
  t.equal(sub.planned, 5);
  sub.plan(0);
  t.equal(sub.planned, 0);
});

test('Tester.plan: rejects non-integer input', t => {
  const sub = new Tester(0, new SpyReporter());
  t.throws(() => sub.plan('a'), TypeError);
  t.throws(() => sub.plan(null), TypeError);
  t.throws(() => sub.plan(undefined), TypeError);
  t.throws(() => sub.plan(1.5), TypeError);
  t.throws(() => sub.plan(NaN), TypeError);
});

test('Tester.plan: rejects negative input', t => {
  const sub = new Tester(0, new SpyReporter());
  t.throws(() => sub.plan(-1), TypeError);
});

// --- runTests integration ---

// Capture every event reported through the suite reporter while body runs.
const captureEvents = async (t, body) => {
  const reporter = t.reporter;
  const orig = reporter.report;
  const events = [];
  reporter.report = function (event, suppressStopTest) {
    events.push(event);
    return orig.call(this, event, suppressStopTest);
  };
  try {
    await body();
  } finally {
    delete reporter.report;
  }
  return events;
};

const findPlanComment = events =>
  events.find(e => e.type === 'comment' && /^plan != count:/.test(e.name || ''));

test('runTests: plan diagnostic when count is short', async t => {
  const events = await captureEvents(t, () =>
    t.test('inner-short', tt => {
      tt.plan(3);
      tt.pass();
    })
  );
  const c = findPlanComment(events);
  t.ok(c, 'plan diagnostic comment was emitted');
  t.equal(c.name, 'plan != count: expected 3, ran 1');
});

test('runTests: plan diagnostic when count overruns', async t => {
  const events = await captureEvents(t, () =>
    t.test('inner-over', tt => {
      tt.plan(1);
      tt.pass();
      tt.pass();
      tt.pass();
    })
  );
  const c = findPlanComment(events);
  t.ok(c, 'plan diagnostic comment was emitted');
  t.equal(c.name, 'plan != count: expected 1, ran 3');
});

test('runTests: no diagnostic when plan matches', async t => {
  const events = await captureEvents(t, () =>
    t.test('inner-match', tt => {
      tt.plan(2);
      tt.pass();
      tt.pass();
    })
  );
  t.equal(findPlanComment(events), undefined);
});

test('runTests: no diagnostic when plan was not called', async t => {
  const events = await captureEvents(t, () =>
    t.test('inner-no-plan', tt => {
      tt.pass();
    })
  );
  t.equal(findPlanComment(events), undefined);
});

test("runTests: subtest asserts don't count toward parent's plan", async t => {
  const events = await captureEvents(t, () =>
    t.test('outer-with-subtest', async tt => {
      tt.plan(2);
      tt.pass();
      await tt.test('grandchild', ttt => {
        ttt.pass();
        ttt.pass();
        ttt.pass();
      });
      tt.pass();
    })
  );
  // Outer ran exactly 2 direct asserts; grandchild's 3 don't apply.
  const planComments = events.filter(
    e => e.type === 'comment' && /^plan != count:/.test(e.name || '')
  );
  t.equal(planComments.length, 0, 'no diagnostic — direct asserts match plan');
});
