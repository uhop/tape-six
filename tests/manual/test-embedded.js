import test from '../../index.js';

test('Simple smoke test', async t => {
  t.pass();
  t.fail();
  await t.test('Embedded test', async t => {
    t.pass('embedded pass');
    t.fail('embedded fail');
  });
  t.pass('pass after');
  t.fail('fail after');
});

test('Natural embedded (outer)', async t => {
  t.pass('Outer pass #1');
  await t.test('Natural embedded (inner)', t => {
    // should be `await test(...);
    t.pass('Inner pass #1');
  });
  t.pass('Outer pass #2');
});
