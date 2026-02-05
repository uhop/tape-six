import {describe, test, it} from '../index.js';
import {expect} from 'chai';

// the example is from Jest's documentation
// https://jestjs.io/docs/api#describename-fn
// (corrected for Chai's expect())

const myBeverage = {
  delicious: true,
  sour: false
};

describe('my beverage', () => {
  test('is delicious', () => {
    expect(myBeverage.delicious).to.be.ok; // toBeTruthy();
  });

  test('is not sour', () => {
    expect(myBeverage.sour).to.be.not.ok; // toBeFalsy();
  });
});

// the example from Node.js documentation
// https://nodejs.org/api/test.html

describe('A thing', () => {
  it('should work', () => {
    expect(1).to.be.equal(1); // assert.strictEqual(1, 1);
  });

  it('should be ok', () => {
    expect(2).to.be.equal(2); // assert.strictEqual(2, 2);
  });

  describe('a nested thing', () => {
    it('should work', () => {
      expect(3).to.be.equal(3); // assert.strictEqual(3, 3);
    });
  });
});
