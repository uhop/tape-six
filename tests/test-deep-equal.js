import test from '../index.js';

test('Deep equal', t => {
  t.deepEqual([1, 2, 3], [1, t.any, 3]);
});
