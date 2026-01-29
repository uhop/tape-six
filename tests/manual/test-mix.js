import test from '../../index.js';

test('External no async', t => {
  t.pass('external #1');
  t.test('Internal', async t => {
    t.pass('internal');
  });
  t.pass('external #2');
});

test('External async', async t => {
  t.pass('external #1');
  await t.test('Internal', async t => {
    t.pass('internal');
  });
  t.pass('external #2');
});

test('Mixed', async t => {
  t.pass('external #1');
  await t.test('Internal', async tt => {
    t.pass('external #2');
    tt.pass('internal');
    t.pass('external #3');
  });
  t.pass('external #4');
});
