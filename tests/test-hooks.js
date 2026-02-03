import {test, beforeAll, afterAll, beforeEach, afterEach} from '../index.js';

let counter = 0;

test('Hooks', async t => {
  beforeAll(() => ++counter);
  afterAll(() => --counter);

  t.equal(counter, 0, 'counter == 0');

  await t.test('Inner #1', async t => {
    t.equal(counter, 1, 'counter == 1');
  });

  beforeEach(() => ++counter);
  afterEach(() => --counter);

  t.equal(counter, 1, 'counter == 1');

  await t.test('Inner #2', async t => {
    t.equal(counter, 2, 'counter == 2');
  });

  t.equal(counter, 1, 'counter == 1');
});
