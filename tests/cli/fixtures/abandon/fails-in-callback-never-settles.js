import test from '../../../../index.js';

test.afterAll(() => console.log('MARK afterAll'));

test('fails in a callback, then never settles', async t => {
  setInterval(() => {}, 1000);
  setTimeout(() => t.fail('in the callback'), 50);
  await new Promise(() => {});
});
