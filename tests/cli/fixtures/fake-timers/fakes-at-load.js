import {mock} from 'node:test';

import test from '../../../../index.js';

// held before the fake: the test waits past the start timer on the real clock
const realSetTimeout = globalThis.setTimeout;
mock.timers.enable({apis: ['setTimeout']});

test('waits past the start timer with timers faked at load', async t => {
  await new Promise(resolve => realSetTimeout(resolve, 600));
  t.pass('done');
});
