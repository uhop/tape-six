import test from '../../../../index.js';

test('passing B', async t => {
  await new Promise(r => setTimeout(r, 30));
  t.pass('ok');
});
