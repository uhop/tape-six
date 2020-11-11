import test from '../../index.js';
import timeout from '../../src/utils/timeout.js';

test('Timeout test', {timeout: 20}, async t => {
  t.pass();
  await timeout(50);
  t.pass();
});
