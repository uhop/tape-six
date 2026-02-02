import test from '../../index.js';

test.todo('Simple smoke test', async t => {
  t.pass();
  t.fail();
  await t.test('Embedded test', async t => {
    t.pass('embedded pass');
    t.fail('embedded fail');
  });
  t.pass('pass after');
  t.fail('fail after');
});
