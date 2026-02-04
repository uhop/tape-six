import test from '../index.js';

test('OK test', t => {
  eval(t.OK('1 < 2'));

  const a = 1,
    b = 2,
    c = 'three',
    d = {a: 1, b: 2};
  eval(t.OK('a < b'));
  eval(t.TRUE('a + b + c == "3three"'));
  eval(t.ASSERT('d.a < d.b'));
});

test('OK test with self', tt => {
  eval(tt.OK('1 < 2', 'internal check', {self: 'tt'}));
  eval(tt.OK('1 < 2', {self: 'tt'}));
});
