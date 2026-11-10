import test from '../../../../index.js';

test.afterAll(() => console.log('MARK afterAll'));

test('asserts in a callback after a sibling failed', async t => {
  await new Promise(resolve =>
    setTimeout(() => {
      t.pass('in the callback');
      resolve();
    }, 300)
  );
});
