// node:test mock — verified Node-only because Bun does not implement `mock`
// from `node:test` and Deno does not implement `mock.timers` (as of 2026-05).
// Wired to the `node` config section in package.json so it runs only when
// invoked through tape6-node (or tape6 detecting Node).
import {mock} from 'node:test';

import test from '../../index.js';

test('mock.fn: spy records calls', t => {
  const spy = mock.fn();
  spy(1, 2);
  spy('x');
  t.equal(spy.mock.calls.length, 2);
  t.deepEqual(spy.mock.calls[0].arguments, [1, 2]);
  t.deepEqual(spy.mock.calls[1].arguments, ['x']);
});

test('mock.fn: stub return values', t => {
  const greet = mock.fn(() => 'default');
  t.equal(greet(), 'default');
  greet.mock.mockImplementationOnce(() => 'override-once');
  t.equal(greet(), 'override-once');
  t.equal(greet(), 'default');
});

test('mock.method: replace and restore a method on an object', t => {
  const obj = {add: (a, b) => a + b};
  const spy = mock.method(obj, 'add', () => 99);
  t.equal(obj.add(2, 3), 99);
  t.equal(spy.mock.calls.length, 1);
  spy.mock.restore();
  t.equal(obj.add(2, 3), 5);
});

test('mock.timers: tick advances setTimeout deterministically', t => {
  mock.timers.enable({apis: ['setTimeout']});
  try {
    let fired = false;
    setTimeout(() => {
      fired = true;
    }, 1000);
    t.notOk(fired, 'not fired before tick');
    mock.timers.tick(1000);
    t.ok(fired, 'fired after tick');
  } finally {
    mock.timers.reset();
  }
});
