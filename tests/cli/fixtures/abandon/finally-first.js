import test from '../../../../index.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test.afterAll(() => console.log('MARK afterAll'));

test('fails in its body, cleans up in finally', async t => {
  try {
    await sleep(50);
    t.fail('in the body');
  } finally {
    await sleep(50);
    console.log('MARK finally');
  }
});
