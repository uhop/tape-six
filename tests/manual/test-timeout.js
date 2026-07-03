import test from '../../index.js';

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Timeout test', {timeout: 20}, async t => {
  t.pass();
  await timeout(50);
  t.pass();
});
