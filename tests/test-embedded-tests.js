import test from 'tape-six';

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

test('foo', async (t) => {
  await timeout(10);
  t.equal(1, 1);
  await timeout(10);

  await t.test('baz', async (t) => {
    await timeout(10);
    t.equal(1, 1);
    await timeout(10);
  });

  await t.test('qux', async (t) => {
    await timeout(10);
    t.equal(1, 1);
    await timeout(10);
  });
});

test('bar', async (t) => {
  await timeout(10);
  t.equal(1, 1);
  await timeout(10);
});
