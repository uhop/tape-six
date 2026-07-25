import test from '../../../../index.js';

test('passing sibling B', async t => {
  await new Promise(r => setTimeout(r, 150));
  t.pass('B done');
});
