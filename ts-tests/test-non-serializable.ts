import test from '../index.js';

test('Non serializable', t => {
  const fn = () => 42;
  t.equal(fn, t.any);

  const sym = Symbol();
  t.equal(sym, t.any);
});
