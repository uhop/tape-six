import test from '../../index.js';

test('Simple smoke test', async t => {
  t.pass();
  t.fail();
  await t.skip('Embedded test', async t => {
    t.pass('embedded pass');
    t.fail('embedded fail');
  });
  t.pass('pass after');
  t.fail('fail after');
  t.skipTest('skipped assert');
});
