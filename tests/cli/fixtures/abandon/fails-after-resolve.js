import test from '../../../../index.js';

test.afterAll(() => console.log('MARK afterAll'));

test('fails in a callback after resolve', async t => {
  await new Promise(resolve =>
    setTimeout(() => {
      resolve();
      t.fail('in the callback');
    }, 50)
  );
});
