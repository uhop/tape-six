import test from '../../../../index.js';

let seen = 0;
process.on('uncaughtException', error =>
  console.log(`MARK own listener: ${error.message} #${++seen}`)
);

test('throws in a callback that the file handles', async t => {
  setTimeout(() => {
    throw new Error('handled');
  }, 20);
  await new Promise(resolve => setTimeout(resolve, 100));
  t.pass('still running');
});
