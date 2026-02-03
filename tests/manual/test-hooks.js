import test from '../../index.js';

test.beforeAll(() => console.log('beforeAll #1'));
test.beforeAll(() => console.log('beforeAll #2'));
test.afterAll(() => console.log('afterAll #1'));
test.afterAll(() => console.log('afterAll #2'));

test.beforeEach(() => console.log('beforeEach #1'));
test.beforeEach(() => console.log('beforeEach #2'));
test.afterEach(() => console.log('afterEach #1'));
test.afterEach(() => console.log('afterEach #2'));

test('Hooks (outer)', async t => {
  t.pass();
  test.beforeAll(() => console.log('beforeAll (outer) #1'));
  t.beforeAll(() => console.log('beforeAll (outer) #2'));
  test.afterAll(() => console.log('afterAll (outer) #1'));
  t.afterAll(() => console.log('afterAll (outer) #2'));
  test.beforeEach(() => console.log('beforeEach (outer) #1'));
  t.beforeEach(() => console.log('beforeEach (outer) #2'));
  test.afterEach(() => console.log('afterEach (outer) #1'));
  t.afterEach(() => console.log('afterEach (outer) #2'));
  await t.test('Hooks (inner) #1', t => {
    t.pass();
  });
  await t.test('Hooks (inner) #2', t => {
    t.pass();
  });
});
