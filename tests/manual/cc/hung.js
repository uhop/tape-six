import test from '../../../index.js';

// Non-cooperative: ignores t.signal and never settles, with a live timer
// holding the event loop open. It cannot be drained — the only way to stop it
// is the parent's force-kill backstop (SIGTERM after graceTimeout). Used to
// prove the worker deadline (TAPE6_WORKER_TIMEOUT) actually kills a hung child.
test('hung non-cooperative test', async t => {
  t.pass('hung started');
  await new Promise(() => {
    setInterval(() => {}, 1000);
  });
  t.pass('NEVER REACHED');
});
