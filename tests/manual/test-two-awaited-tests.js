import test from '../index.js';

await test('Simple smoke test', t => {
  t.pass();
  t.ok(1 < 2);
  t.notOk(1 > 2);
  t.error(null);
  t.strictEqual(2, 2);
  t.looseEqual(2, '2');
  t.deepEqual([1], [1]);
  t.notDeepEqual([1], 1);
});

await test('Simple smoke test', t => {
  t.pass();
  t.ok(1 < 2);
  t.notOk(1 > 2);
  t.error(null);
  t.strictEqual(2, 2);
  t.looseEqual(2, '2');
  t.deepEqual([1], [1]);
  t.notDeepEqual([1], 1);
});
