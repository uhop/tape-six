import test from '../index.js';
import {
  test as namedTest,
  suite,
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  before,
  after
} from '../index.js';
import type {TestOptions, Tester, Test} from '../index.js';

// default import is callable
test('default import', t => {
  t.pass();
});

// named import is the same type
namedTest('named import', t => {
  t.pass();
});

// aliases share the Test type
const checkTest: Test = test;
const checkSuite: Test = suite;
const checkDescribe: Test = describe;
const checkIt: Test = it;

// top-level hooks accept sync and async functions
beforeAll(() => {});
afterAll(() => {});
beforeEach(() => {});
afterEach(() => {});
before(() => {});
after(() => {});
beforeAll(async () => {});
afterAll(async () => {});

// verify aliases work as test registrars
suite('suite alias', t => {
  t.pass();
});

describe('describe alias', () => {
  it('it alias', t => {
    t.pass();
  });
});
