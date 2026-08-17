import test from '../index.js';
import EventServer from '../src/utils/EventServer.js';
import defer from '../src/utils/defer.js';

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fake reporter: flips state.stopTest when it sees a stopTest / bail-out event,
// mirroring how the real reporters propagate stopTest through preprocess. That
// flag is the signal the control plane's stop/bail trigger keys off.
const makeReporter = () => ({
  state: {stopTest: false},
  report(event) {
    if (event && (event.stopTest || event.type === 'bail-out')) this.state.stopTest = true;
  }
});

// Fake transport: records control-plane calls instead of spawning a worker.
// makeTask hands back a synthetic id; destroyTask logs (id, reason).
class FakeWorker extends EventServer {
  constructor(reporter, numberOfTasks, options) {
    super(reporter, numberOfTasks, options);
    this.counter = 0;
    this.made = [];
    this.destroyed = [];
  }
  makeTask(fileName) {
    const id = String(++this.counter);
    this.made.push({id, fileName});
    this.onMade?.();
    return id;
  }
  destroyTask(id, reason) {
    this.destroyed.push({id, reason});
  }
}

test('control channel: createTask tracks live tasks up to parallelism', t => {
  const w = new FakeWorker(makeReporter(), 2, {});
  w.execute(['a.js', 'b.js', 'c.js']);
  t.equal(w.made.length, 2, 'only `parallelism` workers start immediately');
  t.equal(w.liveTasks.size, 2, 'both are tracked as live');
  t.equal(w.fileQueue.length, 1, 'the third file is queued');
});

test(
  'control channel: close terminates with `done` and drains the queue',
  {timeout: 1000},
  async t => {
    const w = new FakeWorker(makeReporter(), 1, {});
    w.execute(['a.js', 'b.js']);
    t.equal(w.made.length, 1, 'one task at a time');

    // await the deferred start itself — a fixed sleep races the wrong scheduler
    // (setTimeout vs requestIdleCallback in browsers)
    const secondStarted = new Promise(resolve => (w.onMade = resolve));
    w.close('1');
    t.deepEqual(
      w.destroyed.at(-1),
      {id: '1', reason: 'done'},
      'finished worker torn down as `done`'
    );
    t.notOk(w.liveTasks.has('1'), 'no longer live');

    await secondStarted;
    t.equal(w.made.length, 2, 'queued file starts once a slot frees');
    t.ok(w.liveTasks.has('2'), 'the queued task is tracked too');
  }
);

test('control channel: stopTest terminates every in-flight worker', t => {
  const w = new FakeWorker(makeReporter(), 3, {});
  w.execute(['a.js', 'b.js', 'c.js']);
  t.equal(w.liveTasks.size, 3, 'three workers in flight');

  // worker 1 reports a failOnce failure (a stopTest event)
  w.report('1', {type: 'assert', fail: true, stopTest: true});

  const aborted = w.destroyed
    .filter(c => c.reason === 'failOnce')
    .map(c => c.id)
    .sort();
  t.deepEqual(aborted, ['1', '2', '3'], 'all live workers told to terminate');
  t.ok(w.stopRequested, 'the stop trigger fired');
});

test('control channel: the stop trigger fires at most once', t => {
  const w = new FakeWorker(makeReporter(), 2, {});
  w.execute(['a.js', 'b.js']);

  w.report('1', {type: 'assert', fail: true, stopTest: true});
  const first = w.destroyed.filter(c => c.reason === 'failOnce').length;
  w.report('1', {type: 'assert', fail: true, stopTest: true});
  const second = w.destroyed.filter(c => c.reason === 'failOnce').length;

  t.equal(first, second, 'no extra terminate calls on a second stopTest event');
});

// The force-kill path closes the task itself — a worker killed after the grace
// window never sends its own `end`. That makes a second close reachable (a
// queued `end` landing after the kill), and a double decrement would end the
// run while siblings are still live.
test('control channel: closing a task twice is a no-op', t => {
  const w = new FakeWorker(makeReporter(), 2, {});
  let doneCount = 0;
  w.done = () => ++doneCount;
  w.execute(['a.js', 'b.js']);

  w.close('1');
  w.close('1');
  t.equal(w.totalTasks, 1, 'the second close does not drop the surviving task');
  t.equal(doneCount, 0, 'the run is not declared finished early');

  w.close('2');
  t.equal(doneCount, 1, 'done fires once, when the last task closes');
});

test('control channel: a buffered stop still cancels the queue', async t => {
  const w = new FakeWorker(makeReporter(), 2, {});
  w.execute(['a.js', 'b.js', 'c.js']);
  w.report('1', {type: 'test', test: 0}); // task 1 claims the pass-through lane

  // task 2's failure is retained behind task 1, so the reporter never sees the
  // stop — the queue must key off the server's own trigger instead
  w.report('2', {type: 'assert', fail: true, stopTest: true});
  t.notOk(w.reporter.state.stopTest, 'the reporter has not seen the stop yet');
  t.ok(w.stopRequested, 'the server has');

  w.close('2');
  t.equal(w.totalTasks, 1, 'no replacement task was scheduled');

  // the queue advance is deferred — ride the same scheduler to observe it
  await new Promise(resolve => defer(resolve));
  t.equal(w.made.length, 2, 'no worker started for the queued file');
});

test('control channel: buffered events are flushed when the run ends', t => {
  const seen = [],
    reporter = {
      state: {stopTest: false},
      report(event) {
        seen.push(event);
        if (event && (event.stopTest || event.type === 'bail-out')) this.state.stopTest = true;
      }
    },
    w = new FakeWorker(reporter, 2, {});
  w.execute(['a.js', 'b.js']);
  w.report('1', {type: 'test', test: 0});
  w.report('2', {type: 'assert', fail: true, name: 'boom'});
  t.notOk(
    seen.some(event => event.name === 'boom'),
    'the failure is buffered behind the pass-through lane'
  );

  // simulate the invariant break this net guards: task 2 disappears without
  // closing, so nothing else would ever release its lane
  --w.totalTasks;
  w.close('1');
  t.ok(
    seen.some(event => event.name === 'boom'),
    'it still reaches the reporter rather than being dropped'
  );
});

test('control channel: a task closed inside makeTask is not tracked as live', t => {
  const w = new FakeWorker(makeReporter(), 1, {workerTimeout: 20});
  w.onMade = () => w.close(String(w.counter));
  w.execute(['unsupported.txt']);

  t.equal(w.liveTasks.size, 0, 'not resurrected as live after the transport closed it');
  t.equal(w.totalTasks, 0, 'accounted for exactly once');
});

test('control channel: worker deadline (Layer 2) terminates a slow worker', async t => {
  const w = new FakeWorker(makeReporter(), 1, {workerTimeout: 20});
  w.execute(['slow.js']);
  t.equal(w.destroyed.length, 0, 'nothing terminated before the deadline');

  await timeout(50);
  t.deepEqual(
    w.destroyed.at(-1),
    {id: '1', reason: 'timeout'},
    'deadline fired a `timeout` terminate'
  );
});

test('control channel: completing before the deadline cancels it', async t => {
  const w = new FakeWorker(makeReporter(), 1, {workerTimeout: 30});
  w.execute(['quick.js']);
  w.close('1');

  await timeout(60);
  t.notOk(
    w.destroyed.some(c => c.reason === 'timeout'),
    'no `timeout` terminate after a clean close'
  );
});

test('control channel: no worker deadline unless configured', async t => {
  const w = new FakeWorker(makeReporter(), 1, {});
  t.equal(w.workerTimeout, 0, 'disabled by default');
  w.execute(['x.js']);

  await timeout(30);
  t.equal(w.destroyed.length, 0, 'nothing terminated');
});

test('control channel: graceTimeout comes from options with a 5s default', t => {
  t.equal(new FakeWorker(makeReporter(), 1, {}).graceTimeout, 5000, 'default grace timeout');
  t.equal(
    new FakeWorker(makeReporter(), 1, {graceTimeout: 1234}).graceTimeout,
    1234,
    'graceTimeout taken from options'
  );
});
