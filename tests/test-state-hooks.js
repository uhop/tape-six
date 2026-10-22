import test from '../index.js';
import {State} from '../src/State.js';

const fakeTimer = {now: () => 0};
const tick = () => new Promise(resolve => setTimeout(resolve, 1));

const slowHook = order => async () => {
  order.push('hook');
  await tick();
  order.push('hook done');
};

test('State: concurrent runBeforeAll calls run each hook once, and both wait for it', async t => {
  const s = new State(null, {name: 'x', timer: fakeTimer});
  const order = [];
  s.beforeAll.push(slowHook(order));
  await Promise.all([
    s.runBeforeAll().then(() => order.push('first')),
    s.runBeforeAll().then(() => order.push('second'))
  ]);
  t.deepEqual(order, ['hook', 'hook done', 'first', 'second']);
  t.ok(s.isBeforeAllUsed);
});

test('State: concurrent runAfterAll calls run each hook once, and both wait for it', async t => {
  const s = new State(null, {name: 'x', timer: fakeTimer});
  const order = [];
  s.afterAll.push(slowHook(order));
  s.isBeforeAllUsed = true;
  await Promise.all([
    s.runAfterAll().then(() => order.push('first')),
    s.runAfterAll().then(() => order.push('second'))
  ]);
  t.deepEqual(order, ['hook', 'hook done', 'first', 'second']);
  t.notOk(s.isBeforeAllUsed);
});

test('State: a later beforeAll/afterAll cycle runs its hooks again', async t => {
  const s = new State(null, {name: 'x', timer: fakeTimer});
  const order = [];
  for (const label of ['one', 'two']) {
    s.beforeAll.push(() => order.push('before ' + label));
    s.afterAll.push(() => order.push('after ' + label));
    await Promise.all([s.runBeforeAll(), s.runBeforeAll()]);
    await Promise.all([s.runAfterAll(), s.runAfterAll()]);
  }
  t.deepEqual(order, ['before one', 'after one', 'before two', 'after two']);
});
