import test from '../../../index.js';

test('before the unrefd wait', t => {
  t.ok(true, 'runs');
});

test('awaits only an unrefd timer', async t => {
  // AbortSignal.timeout is unref'd on Node and Bun — the trigger for the bare-run drain
  await new Promise(resolve => {
    AbortSignal.timeout(200).addEventListener('abort', resolve);
  });
  t.ok(true, 'survived the unrefd wait');
});

test('after the unrefd wait', t => {
  t.ok(true, 'suite reached the end');
});
