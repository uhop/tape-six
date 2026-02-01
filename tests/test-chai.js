import {expect, assert} from 'chai';

import test from '../index.js';

test('Using Chai expect', t => {
  t.pass('Pass #1');
  expect([1]).to.deep.equal([1]);
  t.throws(() => {
    expect([1]).to.deep.equal([2]);
  });
  t.pass('Pass #2');
});

test('Using Chai assert', t => {
  t.pass('Pass #1');
  assert.deepEqual([1], [1]);
  t.throws(() => {
    assert.deepEqual([1], [2], '1 should be equal to 2!');
  });
  t.pass('Pass #2');
});
