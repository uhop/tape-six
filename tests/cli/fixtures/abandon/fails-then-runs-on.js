import test from '../../../../index.js';

test('fails in its body', t => {
  t.fail('boom');
  t.pass('ran past the failure');
});
