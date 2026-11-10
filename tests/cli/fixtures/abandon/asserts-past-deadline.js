import test from '../../../../index.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('keeps asserting past its deadline', async t => {
  for (let i = 0; i < 50; ++i) {
    await sleep(100);
    t.pass('tick ' + i);
  }
});
