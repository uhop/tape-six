import test from '../index.js';

test('console test', t => {
  console.log('#1');
  t.pass();
  console.log('#2');
  console.log('#2a');
  t.ok(1 < 2);
  console.log('#3');
});
