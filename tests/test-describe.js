import {describe, test, it} from '../index.js';

// the example is from Jest's documentation
// https://jestjs.io/docs/api#describename-fn

const myBeverage = {
  delicious: true,
  sour: false
};

describe('my beverage', () => {
  test('is delicious', t => {
    t.ok(myBeverage.delicious); // toBeTruthy()
  });

  test('is not sour', t => {
    t.notOk(myBeverage.sour); // toBeFalsy()
  });
});

// the example from Node.js documentation
// https://nodejs.org/api/test.html

describe('A thing', () => {
  it('should work', t => {
    t.equal(1, 1); // assert.strictEqual(1, 1)
  });

  it('should be ok', t => {
    t.equal(2, 2); // assert.strictEqual(2, 2)
  });

  describe('a nested thing', () => {
    it('should work', t => {
      t.equal(3, 3); // assert.strictEqual(3, 3)
    });
  });
});
