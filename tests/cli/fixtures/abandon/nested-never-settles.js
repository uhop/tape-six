import test from '../../../../index.js';

test('parent', {timeout: 100}, async t => {
  await t.test('child', async () => {
    await new Promise(() => {});
  });
});

test('runs after it', t => {
  t.pass('next test');
});
