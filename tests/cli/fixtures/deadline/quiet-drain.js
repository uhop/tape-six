import test from '../../../../index.js';

// stops on its abort signal and fails nothing, so only the deadline can fail it
test('drains at its deadline', async t => {
  t.pass('started');
  await new Promise(resolve => {
    if (t.signal.aborted) return resolve();
    t.signal.addEventListener('abort', resolve);
  });
});
