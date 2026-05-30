import test from '../../../index.js';

// Manual control-channel fixture. A long, signal-aware wait: when the parent
// issues `terminate` (failOnce drain or worker deadline), t.signal fires and
// the wait rejects, so the test unwinds *before* reaching the FINISHED assert.
// The finally block proves user cleanup still runs on a drained test.
test('slow signal-aware test A', async t => {
  t.pass('A started');
  try {
    await new Promise((resolve, reject) => {
      const id = setTimeout(resolve, 10_000);
      t.signal.addEventListener('abort', () => {
        clearTimeout(id);
        reject(new Error('A terminated by control channel'));
      });
    });
    t.pass('A FINISHED — should not print when drained');
  } finally {
    console.error('CLEANUP A ran');
  }
});
