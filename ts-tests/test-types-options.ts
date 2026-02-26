import test from '../index.js';
import type {TestOptions} from '../index.js';

// all TestOptions fields
const fullOpts: TestOptions = {
  name: 'opts test',
  testFn: t => {
    t.pass();
  },
  skip: false,
  todo: false,
  timeout: 5000,
  beforeAll: () => {},
  afterAll: () => {},
  beforeEach: () => {},
  afterEach: () => {},
  before: () => {},
  after: () => {}
};

// async hooks in options
const asyncOpts: TestOptions = {
  beforeAll: async () => {},
  afterAll: async () => {},
  beforeEach: async () => {},
  afterEach: async () => {},
  before: async () => {},
  after: async () => {}
};

// minimal options
const minOpts: TestOptions = {};

// options with only name
const nameOnly: TestOptions = {name: 'just a name'};

// options used in test() calls
test('with full options', fullOpts);
test('with timeout', {timeout: 100}, t => {
  t.pass();
});
test('with skip option', {skip: true}, t => {
  t.fail();
});
test('with todo option', {todo: true}, t => {
  t.fail();
});
test(
  'with hooks in options',
  {
    beforeAll: () => {},
    afterAll: () => {},
    beforeEach: () => {},
    afterEach: () => {}
  },
  async t => {
    await t.test('inner', t => {
      t.pass();
    });
  }
);

// async testFn in options
const asyncTestOpts: TestOptions = {
  name: 'async fn',
  testFn: async t => {
    t.pass();
  }
};
test('with async testFn option', asyncTestOpts);
