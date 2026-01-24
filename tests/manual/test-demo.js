// import test from 'tape-six';
import test from '../../index.js';

test('demo', t => {
  const a = 1, b = 2, c = 3;
  t.ok(a === 1, 'should pass');
  t.equal(a * b, 2);
  t.deepEqual([a, b, c], [1, 2, t.any]);
  eval(t.OK('a + b + c === 6'));
});
