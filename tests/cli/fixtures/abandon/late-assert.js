import test from '../../../../index.js';

test('first', t => {
  setTimeout(() => t.fail('late failure'), 50);
  t.pass('first passes');
});

test('second', async t => {
  await new Promise(resolve => setTimeout(resolve, 200));
  t.pass('second passes');
});
