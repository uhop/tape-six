import assert from 'node:assert';

import test from '../../index.js';

// Smoke test for the AssertionError-recognition path. Any third-party assertion
// library that throws a node-compatible AssertionError (chai, expect, jest's
// expect, should, etc.) flows through the same handler, so this Node-only test
// stands in for all of them in CI.

test('node:assert: passing strict.deepEqual flows through cleanly', t => {
  t.pass('before assertion');
  assert.strict.deepEqual([1], [1]);
  t.pass('after assertion');
});

test('node:assert: failing strict.deepEqual throws AssertionError', t => {
  t.throws(
    () => assert.strict.deepEqual([1], [2]),
    err => err && err.name === 'AssertionError' && typeof err.operator === 'string',
    'failure surfaces as a node:assert AssertionError'
  );
});

test('node:assert: ok / equal / notEqual cover the common shapes', t => {
  assert.ok(true);
  assert.equal(1, 1);
  assert.notEqual(1, 2);
  t.pass('all three passed without throwing');
});
