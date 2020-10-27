import test from '../../index.js';
import './test-general.js';

test('Simple smoke test #1', async t => {
  t.pass();
  t.fail();
  t.ok(1 < 2);
  t.ok(1 > 2);
  t.notOk(1 < 2);
  t.notOk(1 > 2);
  t.error(null);
  t.error(new Error('123'));
});

test('Simple smoke test #2', async t => {
  t.strictEqual(1, 2);
  t.strictEqual(2, 2);
  t.strictEqual(2, "2");
  t.looseEqual(2, "2");
  t.looseEqual(2, "3");
  t.deepEqual([1], [1]);
  t.notDeepEqual([1], [1]);
});
