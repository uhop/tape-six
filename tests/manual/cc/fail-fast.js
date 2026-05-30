import test from '../../../index.js';

// Fails immediately. Under failOnce (flag F/O) this sets stopTest, which should
// drain the slow siblings still in flight.
test('fast failing test', t => {
  t.fail('boom — triggers failOnce');
});
