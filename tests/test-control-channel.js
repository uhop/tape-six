import test from '../index.js';
import EventServer from '../src/utils/EventServer.js';

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

test('control channel: close terminates with `done` and drains the queue', async t => {
  const w = new FakeWorker(makeReporter(), 1, {});
  w.execute(['a.js', 'b.js']);
  t.equal(w.made.length, 1, 'one task at a time');

  w.close('1');
  t.deepEqual(w.destroyed.at(-1), {id: '1', reason: 'done'}, 'finished worker torn down as `done`');
  t.notOk(w.liveTasks.has('1'), 'no longer live');

  await timeout(10); // let the deferred next task start
  t.equal(w.made.length, 2, 'queued file starts once a slot frees');
  t.ok(w.liveTasks.has('2'), 'the queued task is tracked too');
});

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
