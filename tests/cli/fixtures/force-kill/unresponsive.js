import test from '../../../../index.js';

// reports at once so it wins the pass-through lane, then ignores the abort
// signal — the parent has to force-kill it after graceTimeout
test('unresponsive sibling', async t => {
  t.pass('started');
  await new Promise(r => setTimeout(r, 10000));
  t.pass('never reached');
});
