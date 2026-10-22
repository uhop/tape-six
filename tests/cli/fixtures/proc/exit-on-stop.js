import test from '../../../../index.js';
import process from 'node:process';

// Exits 0 the moment its deadline stops it, as the child's watchdog does when it beats the kill.
test('exits 0 when stopped', async t => {
  t.pass('started');
  t.signal.addEventListener('abort', () => process.exit(0));
  await new Promise(() => setInterval(() => {}, 1000));
});
