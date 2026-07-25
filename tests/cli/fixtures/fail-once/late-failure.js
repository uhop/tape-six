import test from '../../../../index.js';

// the failing assert throws StopTest inside the async body — under failOnce it
// must reject this test's promise, not escape as an unhandled rejection
test.asPromise('late failure', async (t, resolve) => {
  await new Promise(r => setTimeout(r, 50));
  t.ok(false, 'boom');
  resolve();
});
