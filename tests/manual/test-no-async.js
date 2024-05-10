import test from '../../index.js';

test('Simple smoke test (no async)', t => {
  t.pass();
  t.fail();
  t.ok(1 < 2);
  t.ok(1 > 2);
  t.notOk(1 < 2);
  t.notOk(1 > 2);
  t.error(null);
  t.error(new Error('123'));
  t.strictEqual(1, 2);
  t.strictEqual(2, 2);
  // throw new Error('sudden death!');
  t.strictEqual(2, "2");
  t.looseEqual(2, "2");
  t.looseEqual(2, "3");
  t.deepEqual([1], [1]);
  t.notDeepEqual([1], [1]);
  // await new Promise((_, reject) => reject(new Error(12345)));
});
