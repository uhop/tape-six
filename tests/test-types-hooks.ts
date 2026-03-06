import {test, beforeAll, afterAll, beforeEach, afterEach, before, after} from '../index.js';

// top-level hooks — sync
beforeAll(() => {});
afterAll(() => {});
beforeEach(() => {});
afterEach(() => {});
before(() => {});
after(() => {});

// top-level hooks — async
beforeAll(async () => {});
afterAll(async () => {});
beforeEach(async () => {});
afterEach(async () => {});
before(async () => {});
after(async () => {});

// test.hooks — sync and async
test.beforeAll(() => {});
test.afterAll(() => {});
test.beforeEach(() => {});
test.afterEach(() => {});
test.before(() => {});
test.after(() => {});
test.beforeAll(async () => {});
test.afterAll(async () => {});

// t.hooks — sync and async
test('tester hooks', async t => {
  t.beforeAll(() => {});
  t.afterAll(() => {});
  t.beforeEach(() => {});
  t.afterEach(() => {});
  t.before(() => {});
  t.after(() => {});

  t.beforeAll(async () => {});
  t.afterAll(async () => {});
  t.beforeEach(async () => {});
  t.afterEach(async () => {});
  t.before(async () => {});
  t.after(async () => {});

  await t.test('inner', t => {
    t.pass();
  });
});
