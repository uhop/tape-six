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

test('Embedded tests (waiting)', async t => {
  t.pass('before');
  await t.test('Embedded #1', async t => {
    t.pass('Embedded #1 before pass');
    await t.test('Embedded #2', t => {
      t.pass('Embedded #2 pass');
    });
    t.pass('Embedded #1 after pass');
  });
  t.pass('after');
});

test('Embedded tests (no waiting)', t => {
  t.pass('before');
  t.test('Embedded #1', t => {
    t.pass('Embedded #1 before pass');
    t.test('Embedded #2', t => {
      t.pass('Embedded #2 pass');
    });
    t.pass('Embedded #1 after pass');
  });
  t.pass('after');
});
