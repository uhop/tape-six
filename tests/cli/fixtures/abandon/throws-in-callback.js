import test from '../../../../index.js';

test('throws in a callback', async () => {
  await new Promise(() =>
    setTimeout(() => {
      throw new Error('thrown in a callback');
    }, 20)
  );
});
