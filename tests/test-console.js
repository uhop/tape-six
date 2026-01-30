import test from '../index.js';

test('console test', t => {
  console.assert(true, 'Assertion passed, value is', true);
  console.log('log #1');
  t.pass();
  console.log('log #2');
  console.error('error #1');
  console.log('log #2a');
  t.ok(1 < 2);
  console.log('log #3');
  console.error('error #2');
  console.assert(false, 'Assertion failed, value is', false);
});
