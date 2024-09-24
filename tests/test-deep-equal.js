import test from 'tape-six';

test('Deep equal', t => {
  t.deepEqual([1, 2, 3], [1, t.any, 3]);
});
