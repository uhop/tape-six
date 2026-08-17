import test from '../../../../index.js';

test('bails out', t => {
  t.bailOut('stopping the run');
});
