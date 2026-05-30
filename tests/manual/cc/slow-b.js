import test from '../../../index.js';

test('slow signal-aware test B', async t => {
  t.pass('B started');
  try {
    await new Promise((resolve, reject) => {
      const id = setTimeout(resolve, 10_000);
      t.signal.addEventListener('abort', () => {
        clearTimeout(id);
        reject(new Error('B terminated by control channel'));
      });
    });
    t.pass('B FINISHED — should not print when drained');
  } finally {
    console.error('CLEANUP B ran');
  }
});
