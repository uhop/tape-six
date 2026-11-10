import test from '../../../../index.js';

test.afterAll(() => console.log('MARK afterAll'));

test('never settles', {timeout: 100}, async () => {
  setInterval(() => {}, 1000);
  await new Promise(() => {});
});

test('runs after it', t => {
  t.pass('next test');
});
