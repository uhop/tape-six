import test from '../../index.js';

test('Uncaught exception test', async t => {
  t.pass('this passes before the uncaught exception');
  setTimeout(() => {
    throw new Error('This is an uncaught exception');
  }, 10);
  await new Promise(resolve => setTimeout(resolve, 50));
});
