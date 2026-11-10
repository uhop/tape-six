import test from '../../../../index.js';

test('fails', t => {
  t.fail('boom');
});

test('runs only without fail-once', t => {
  t.pass('after the failure');
});
