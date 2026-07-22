import test from '../index.js';
import Reporter from '../src/reporters/Reporter.js';

// Regression tests for the parallel fail-once masking bug: an aggregating
// reporter receives worker events pre-stamped (processed) and possibly out of
// causal order — a sibling's stopTest event may arrive before the buffered
// failure that triggered it. Counting must follow each event's own flags.

const feed = (reporter, events) => {
  for (const event of events) reporter.report(event, true);
};

test('aggregator counts a buffered failure delivered after a forwarded stopTest', t => {
  const reporter = new Reporter({failOnce: true});
  feed(reporter, [
    {type: 'test', test: 0},
    // the pass-through sibling: aborted mid-flight, its passing assert carries stopTest
    {type: 'test', test: 0, name: 'FILE: /slow', processed: true},
    {type: 'test', test: 1, name: 'slow', processed: true},
    {name: 'ok', test: 1, stopTest: true, processed: true},
    {type: 'end', test: 1, name: 'slow', stopTest: true, processed: true},
    {type: 'end', test: 0, name: 'FILE: /slow', stopTest: true, processed: true},
    // the failing worker's retained events flush afterwards
    {type: 'test', test: 0, name: 'FILE: /fail', processed: true},
    {type: 'test', test: 2, name: 'fast fail', processed: true},
    {name: 'boom', test: 2, fail: true, stopTest: true, processed: true},
    {type: 'end', test: 2, name: 'fast fail', fail: true, processed: true},
    {type: 'end', test: 0, name: 'FILE: /fail', fail: true, processed: true}
  ]);
  const root = reporter.state;
  t.equal(root.failed, 1, 'the buffered failure is counted as failed');
  t.equal(root.skipped, 0, 'nothing is miscounted as skipped');
  t.ok(root.stopTest, 'the aggregator chain is stop-marked');
  t.notOk(root.skip, 'the aggregator chain is not skip-poisoned');
});

test('aggregator trusts a processed event stamped skip by its worker', t => {
  const reporter = new Reporter({failOnce: true});
  feed(reporter, [
    {type: 'test', test: 0},
    {type: 'test', test: 0, name: 'FILE: /aborted', processed: true},
    {type: 'test', test: 1, name: 'aborted', processed: true},
    {name: 'cleanup boom', test: 1, fail: true, skip: true, stopTest: true, processed: true},
    {type: 'end', test: 1, name: 'aborted', stopTest: true, processed: true},
    {type: 'end', test: 0, name: 'FILE: /aborted', stopTest: true, processed: true}
  ]);
  const root = reporter.state;
  t.equal(root.failed, 0, 'a worker-skipped failure is not counted as failed');
  t.equal(root.skipped, 1, 'it is counted as skipped');
});

test('raw chain keeps failOnce skip semantics for subsequent events', t => {
  const reporter = new Reporter({failOnce: true});
  feed(reporter, [
    {type: 'test', test: 0},
    {type: 'test', test: 1, name: 'a'},
    {name: 'boom', test: 1, fail: true},
    {name: 'late', test: 1, fail: true},
    {type: 'end', test: 1, name: 'a'}
  ]);
  const root = reporter.state;
  t.equal(root.failed, 1, 'the triggering failure is counted as failed');
  t.equal(root.skipped, 1, 'a subsequent raw event inherits skip');
  t.ok(root.stopTest, 'the chain is stop-marked');
  t.ok(root.skip, 'the raw chain is skip-marked');
});
