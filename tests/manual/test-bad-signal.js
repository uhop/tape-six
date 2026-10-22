import test from '../../index.js';
import process from 'node:process';

test('bad signal', t => {
  t.pass();
  process.kill(process.pid, 'SIGKILL');
});
