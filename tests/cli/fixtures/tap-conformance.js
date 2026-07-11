import test from '../../../index.js';

test('outer suite', async t => {
  t.ok(true, 'first');
  await t.test('nested child', async tt => {
    tt.equal(1, 1, 'child assert');
    await tt.test('grandchild', ttt => {
      ttt.pass('deep assert');
    });
  });
  t.deepEqual({s: 'x: y #z'}, {s: 'different'}, 'hostile strings in diagnostics');
});

test.todo('todo suite', t => {
  t.fail('todo failure must not crash the reporter');
});

test('skip and throw', t => {
  t.skip('skipped assert');
  throw new Error('kaboom');
});

test('suite reached the end', t => {
  t.ok(true, 'still running');
});
