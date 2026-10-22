import test from '../../../../index.js';
import {existsSync} from 'node:fs';
import process from 'node:process';

// Waits for fail-and-hold.js to fail, so its events queue behind that file's.
const deadline = Date.now() + 10_000;
while (!existsSync(process.env.CRASH_MARKER) && Date.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, 10));
}

test('crashes with the test still open', async t => {
  t.pass('started');
  // lets the events reach the parent: pipe writes are asynchronous on macOS and Windows
  await new Promise(resolve => setTimeout(resolve, 100));
  process.exit(1);
});
