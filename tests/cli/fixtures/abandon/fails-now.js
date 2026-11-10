import {existsSync} from 'node:fs';
import process from 'node:process';

import test from '../../../../index.js';

// Waits for asserts-later.js to start its test, so the stop reaches a body in flight.
const deadline = performance.now() + 10_000;
while (!existsSync(process.env.SIBLING_STARTED) && performance.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, 10));
}

test('fails now', t => {
  t.fail('boom');
});
