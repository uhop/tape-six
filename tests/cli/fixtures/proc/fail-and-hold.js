import test from '../../../../index.js';
import {writeFileSync} from 'node:fs';
import process from 'node:process';

// Fails, then keeps the output lane while crash-in-test.js dies behind it.
test('fails, then holds the lane', async t => {
  t.fail('deliberate failure');
  writeFileSync(process.env.CRASH_MARKER, '');
  await new Promise(resolve => setTimeout(resolve, 1500));
});
