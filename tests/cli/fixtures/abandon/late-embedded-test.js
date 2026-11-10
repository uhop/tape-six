import test from '../../../../index.js';

test('first', {timeout: 50}, async t => {
  await new Promise(resolve => setTimeout(resolve, 100));
  await t.test('late child', async t2 => {
    await new Promise(resolve => setTimeout(resolve, 100));
    t2.pass('late child passes');
  });
});

test('second', async t => {
  await new Promise(resolve => setTimeout(resolve, 120));
  t.pass('second passes');
});

test('third', t => {
  t.pass('third passes');
});
