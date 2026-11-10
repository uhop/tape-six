import test from '../../../../index.js';

test.afterAll(() => console.log('MARK afterAll'));

test('fails in a callback before resolve', async t => {
  await new Promise(resolve =>
    setTimeout(() => {
      t.fail('in the callback');
      resolve();
    }, 50)
  );
});
