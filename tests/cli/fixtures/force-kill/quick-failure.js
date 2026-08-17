import test from '../../../../index.js';

// the delay hands the pass-through lane to the unresponsive sibling, so this
// failure is buffered in a retained lane when the stop fires
await new Promise(r => setTimeout(r, 150));

test('quick failure', t => {
  t.fail('boom');
});
