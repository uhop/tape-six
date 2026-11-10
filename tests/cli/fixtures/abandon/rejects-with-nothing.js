import test from '../../../../index.js';

test('leaves a rejection with no reason unhandled', async t => {
  Promise.reject();
  await new Promise(resolve => setTimeout(resolve, 50));
  t.pass('after the rejection');
});
