import test from '../../../../index.js';

// Ignores t.signal and never settles: only the child's watchdog or the parent's kill ends it.
test('hangs past its stop', async t => {
  t.pass('started');
  await new Promise(() => setInterval(() => {}, 1000));
});
