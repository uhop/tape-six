import test from '../../../../index.js';
import process from 'node:process';

test('quits with the test still open', async t => {
  t.pass('started');
  await new Promise(resolve => setTimeout(resolve, 100));
  process.exit(0);
});
