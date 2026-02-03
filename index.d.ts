/**
 * Test options
 */
export declare interface TestOptions {
  /**
   * The name of the test
   */
  name?: string;

  /**
   * The test function
   */
  testFn?: (t: Tester) => void | Promise<void>;

  /**
   * Skips the test. The test will not be run.
   */
  skip?: boolean;

  /**
   * Marks the test as a TODO. The test can fail or pass and does not count towards the test suite's result.
   */
  todo?: boolean;

  /**
   * The timeout for the test in milliseconds. If the test takes longer than this, it will be stopped.
   * If not specified, no timeout is used for the test.
   */
  timeout?: number;
}

/**
 * Test interface
 */
export declare interface Tester {
  /**
   * A symbol that can be used to match any value.
   */
  any: Symbol;

  /**
   * A symbol that can be used to match any value. An alias of `any`.
   */
  _: Symbol;

  /**
   * Plans the number of assertions that will be run. Unused.
   * @param n - The number of assertions
   */
  plan(n: number): void;

  /**
   * Adds a comment to the test. It is shown in the output, but does not affect the test result.
   * @param msg - The comment message
   */
  comment(msg: string): void;

  /**
   * Skips the test. The test will not be run.
   * @param args - Optional arguments. The last string argument can be a message.
   */
  skipTest(...args: any[]): void;

  /**
   * Stops the test suite. No more tests will be run.
   * @param msg - Optional message to display
   */
  bailOut(msg?: string): void;

  // lifted from `test()`

  /**
   * Creates a new embedded test with the given name and function.
   * @param name - The name of the test
   * @param fn - The test function
   */
  test(name: string, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Creates a new embedded test with the given function.
   * @param fn - The test function
   */
  test(fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Creates a new embedded test with the given options.
   */
  test(options: TestOptions): Promise<void>;

  /**
   * Creates a new embedded test with the given options and function.
   * @param options - The test options
   * @param fn - The test function
   */
  test(options: TestOptions, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Skips the test. The test will not be run.
   * @param name - The name of the test
   * @param fn - The test function
   */
  skip(name: string, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Skips the test. The test will not be run.
   * @param fn - The test function
   */
  skip(fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Skips the test. The test will not be run.
   * @param options - The test options
   */
  skip(options: TestOptions): Promise<void>;

  /**
   * Skips the test. The test will not be run.
   * @param options - The test options
   * @param fn - The test function
   */
  skip(options: TestOptions, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Creates a new embedded test with the given name and function.
   * It is a TODO test, which can fail or pass and does not count towards the test suite's result.
   * @param name - The name of the test
   * @param fn - The test function
   */
  todo(name: string, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Creates a new embedded test with the given function.
   * It is a TODO test, which can fail or pass and does not count towards the test suite's result.
   * @param fn - The test function
   */
  todo(fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Creates a new embedded test with the given options.
   * It is a TODO test, which can fail or pass and does not count towards the test suite's result.
   * @param options - The test options
   */
  todo(options: TestOptions): Promise<void>;

  /**
   * Creates a new embedded test with the given name and function.
   * It is a TODO test, which can fail or pass and does not count towards the test suite's result.
   * @param options - The test options
   * @param fn - The test function
   */
  todo(options: TestOptions, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Runs non-asynchronous callback-based test.
   * @param name - The name of the test
   * @param fn - The test function
   */
  asPromise(
    name: string,
    fn: (t: Tester, resolve: () => void, reject: (error: unknown) => void) => void
  ): Promise<void>;

  /**
   * Runs non-asynchronous callback-based test.
   * @param fn - The test function
   */
  asPromise(
    fn: (t: Tester, resolve: () => void, reject: (error: unknown) => void) => void
  ): Promise<void>;

  /**
   * Runs non-asynchronous callback-based test.
   * @param options - The test options
   */
  asPromise(options: TestOptions): Promise<void>;

  /**
   * Runs non-asynchronous callback-based test.
   * @param options - The test options
   * @param fn - The test function
   */
  asPromise(
    options: TestOptions,
    fn: (t: Tester, resolve: () => void, reject: (error: unknown) => void) => void
  ): Promise<void>;

  // asserts

  /**
   * Asserts that the test passed.
   * @param msg - Optional message to display if the assertion fails
   */
  pass(msg?: string): void;

  /**
   * Asserts that the test failed.
   * @param msg - Optional message to display if the assertion fails
   */
  fail(msg?: string): void;

  /**
   * Asserts that `value` is truthy.
   * @param value - The value to test
   * @param message - Optional message to display if the assertion fails
   */
  ok(value: unknown, message?: string): void;

  /**
   * Asserts that `value` is not truthy.
   * @param value - The value to test
   * @param message - Optional message to display if the assertion fails
   */
  notOk(value: unknown, message?: string): void;

  /**
   * Asserts that `error` is an error and fails the test.
   * @param error - The error to test
   * @param message - Optional message to display if the assertion fails
   */
  error(error: Error | null | unknown, message?: string): void;

  /**
   * Asserts that `actual` is strictly equal to `expected`. Uses `===` comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  strictEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not strictly equal to `expected`. Uses `!==` comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notStrictEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is loosely equal to `expected`. Uses `==` comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  looseEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not loosely equal to `expected`. Uses `!=` comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notLooseEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is deeply equal to `expected`. Uses strict comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  deepEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not deeply equal to `expected`. Uses strict comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notDeepEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is deeply equal to `expected`. Uses loose comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  deepLooseEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not deeply equal to `expected`. Uses loose comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notDeepLooseEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `fn` throws an error.
   * @param fn - The function to test
   * @param message - Optional message to display if the assertion fails
   */
  throws(fn: () => void, message?: string): void;

  /**
   * Asserts that `fn` does not throw an error.
   * @param fn - The function to test
   * @param message - Optional message to display if the assertion fails
   */
  doesNotThrow(fn: () => void, message?: string): void;

  /**
   * Asserts that `string` matches the regular expression `regexp`.
   * @param string - The string to test
   * @param regexp - The regular expression to test against
   * @param message - Optional message to display if the assertion fails
   */
  matchString(string: string, regexp: RegExp, message?: string): void;

  /**
   * Asserts that `string` does not match the regular expression `regexp`.
   * @param string - The string to test
   * @param regexp - The regular expression to test against
   * @param message - Optional message to display if the assertion fails
   */
  doesNotMatchString(string: string, regexp: RegExp, message?: string): void;

  /**
   * Asserts that `actual` matches `expected`. This is a structural object comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  match(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` does not match `expected`. This is a structural object comparison.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  doesNotMatch(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `promise` is rejected.
   * @param promise - The promise to test
   * @param message - Optional message to display if the assertion fails
   */
  rejects(promise: Promise<unknown>, message?: string): Promise<void>;

  /**
   * Asserts that `promise` is resolved.
   * @param promise - The promise to test
   * @param message - Optional message to display if the assertion fails
   */
  resolves(promise: Promise<unknown>, message?: string): Promise<void>;

  /**
   * Returns a code as a string for evaluation that checks if the condition is truthy.
   * @param condition - The JS condition to check as a string
   * @param message - Optional message to display if the assertion fails
   * @param options - Optional options object. `self` is the name of the tester argument, which should be used in the code. Default: `"t"`.
   */
  OK(condition: string, message?: string, options?: {self?: string}): string;
  /**
   * Returns a code as a string for evaluation that checks if the condition is truthy.
   * @param condition - The JS condition to check as a string
   * @param options - Optional options object. `self` is the name of the tester argument, which should be used in the code. Default: `"t"`.
   */
  OK(condition: string, options: {self?: string}): string;

  // aliases

  /**
   * Asserts that `value` is truthy. Alias of `ok`.
   * @param value - The value to test
   * @param message - Optional message to display if the assertion fails
   */
  true(value: unknown, message?: string): void;

  /**
   * Asserts that `value` is truthy. Alias of `ok`.
   * @param value - The value to test
   * @param message - Optional message to display if the assertion fails
   */
  assert(value: unknown, message?: string): void;

  /**
   * Asserts that `value` is falsy. Alias of `notOk`.
   * @param value - The value to test
   * @param message - Optional message to display if the assertion fails
   */
  false(value: unknown, message?: string): void;

  /**
   * Asserts that `value` is not truthy. Alias of `notOk`.
   * @param value - The value to test
   * @param message - Optional message to display if the assertion fails
   */
  notok(value: unknown, message?: string): void;

  /**
   * Asserts that `error` is an error and fails the test. Alias of `error`.
   * @param error - The error to test
   * @param message - Optional message to display if the assertion fails
   */
  ifError(error: Error | null | unknown, message?: string): void;

  /**
   * Asserts that `error` is an error and fails the test. Alias of `error`.
   * @param error - The error to test
   * @param message - Optional message to display if the assertion fails
   */
  ifErr(error: Error | null | unknown, message?: string): void;

  /**
   * Asserts that `error` is an error and fails the test. Alias of `error`.
   * @param error - The error to test
   * @param message - Optional message to display if the assertion fails
   */
  iferror(error: Error | null | unknown, message?: string): void;

  /**
   * Asserts that `a` is strictly equal to `b`. Alias of `strictEqual`.
   * @param a - The first value
   * @param b - The second value
   * @param message - Optional message to display if the assertion fails
   */
  is(a: unknown, b: unknown, message?: string): void;

  /**
   * Asserts that `actual` is deeply equal to `expected`. Alias of `strictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  equal(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is strictly equal to `expected`. Alias of `strictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  equals(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is strictly equal to `expected`. Alias of `strictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  isEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is strictly equal to `expected`. Alias of `strictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  strictEquals(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not equal to `expected`. Alias of `notStrictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  not(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not equal to `expected`. Alias of `notStrictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not equal to `expected`. Alias of `notStrictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notEquals(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not equal to `expected`. Alias of `notStrictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  isNotEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not equal to `expected`. Alias of `notStrictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  doesNotEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not equal to `expected`. Alias of `notStrictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  isUnequal(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not equal to `expected`. Alias of `notStrictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notStrictEquals(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not equal to `expected`. Alias of `notStrictEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  isNot(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is loosely equal to `expected`. Alias of `looseEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  looseEquals(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not loosely equal to `expected`. Alias of `notLooseEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notLooseEquals(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is deeply equal to `expected`. Alias of `deepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  same(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is deeply equal to `expected`. Alias of `deepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  deepEquals(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is deeply equal to `expected`. Alias of `deepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  isEquivalent(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not deeply equal to `expected`. Alias of `notDeepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notSame(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not deeply equal to `expected`. Alias of `notDeepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notDeepEquals(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not deeply equal to `expected`. Alias of `notDeepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notEquivalent(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not deeply equal to `expected`. Alias of `notDeepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  notDeeply(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not deeply equal to `expected`. Alias of `notDeepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  isNotDeepEqual(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `actual` is not deeply equal to `expected`. Alias of `notDeepEqual`.
   * @param actual - The actual value
   * @param expected - The expected value
   * @param message - Optional message to display if the assertion fails
   */
  isNotEquivalent(actual: unknown, expected: unknown, message?: string): void;

  /**
   * Asserts that `promise` is rejected. Alias of `rejects`.
   * @param promise - The promise to test
   * @param message - Optional message to display if the assertion fails
   */
  doesNotResolve(promise: Promise<unknown>, message?: string): Promise<void>;

  /**
   * Asserts that `promise` is resolved. Alias of `resolves`.
   * @param promise - The promise to test
   * @param message - Optional message to display if the assertion fails
   */
  doesNotReject(promise: Promise<unknown>, message?: string): Promise<void>;

  /**
   * Returns a code as a string for evaluation that checks if the condition is truthy.
   * @param condition - The JS condition to check as a string
   * @param message - Optional message to display if the assertion fails
   * @param options - Optional options object. `self` is the name of the tester argument, which should be used in the code. Default: `"t"`.
   */
  TRUE(condition: string, message?: string, options?: {self?: string}): string;
  /**
   * Returns a code as a string for evaluation that checks if the condition is truthy.
   * @param condition - The JS condition to check as a string
   * @param options - Optional options object. `self` is the name of the tester argument, which should be used in the code. Default: `"t"`.
   */
  TRUE(condition: string, options: {self?: string}): string;

  /**
   * Returns a code as a string for evaluation that checks if the condition is truthy.
   * @param condition - The JS condition to check as a string
   * @param message - Optional message to display if the assertion fails
   * @param options - Optional options object. `self` is the name of the tester argument, which should be used in the code. Default: `"t"`.
   */
  ASSERT(condition: string, message?: string, options?: {self?: string}): string;
  /**
   * Returns a code as a string for evaluation that checks if the condition is truthy.
   * @param condition - The JS condition to check as a string
   * @param options - Optional options object. `self` is the name of the tester argument, which should be used in the code. Default: `"t"`.
   */
  ASSERT(condition: string, options: {self?: string}): string;
}

export declare interface Test {
  /**
   * Creates a new test with the given name and function.
   * @param name - The name of the test
   * @param fn - The test function
   */
  (name: string, fn: (t: Tester) => void | Promise<void>): Promise<void>;
  /**
   * Creates a new test with the given function.
   * @param fn - The test function
   */
  (fn: (t: Tester) => void | Promise<void>): void;
  /**
   * Creates a new test with the given options.
   * @param options - The test options
   */
  (options: TestOptions): Promise<void>;
  /**
   * Creates a new test with the given options and function.
   * @param options - The test options
   * @param fn - The test function
   */
  (options: TestOptions, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Creates a new test that will be skipped.
   * @param name - The name of the test
   * @param fn - The test function
   */
  skip(name: string, fn: (t: Tester) => void | Promise<void>): Promise<void>;
  /**
   * Creates a new test that will be skipped.
   * @param fn - The test function
   */
  skip(fn: (t: Tester) => void | Promise<void>): Promise<void>;
  /**
   * Creates a new test that will be skipped.
   * @param options - The test options
   */
  skip(options: TestOptions): Promise<void>;
  /**
   * Creates a new test that will be skipped.
   * @param options - The test options
   * @param fn - The test function
   */
  skip(options: TestOptions, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Creates a new test that will be TODO.
   * @param name - The name of the test
   * @param fn - The test function
   */
  todo(name: string, fn: (t: Tester) => void | Promise<void>): Promise<void>;
  /**
   * Creates a new test that will be TODO.
   * @param fn - The test function
   */
  todo(fn: (t: Tester) => void | Promise<void>): Promise<void>;
  /**
   * Creates a new test that will be TODO.
   * @param options - The test options
   */
  todo(options: TestOptions): Promise<void>;
  /**
   * Creates a new test that will be TODO.
   * @param options - The test options
   * @param fn - The test function
   */
  todo(options: TestOptions, fn: (t: Tester) => void | Promise<void>): Promise<void>;

  /**
   * Creates a new test that will be run as a promise.
   * Usually used for asynchronous tests that are based on callbacks.
   * @param name - The name of the test
   * @param fn - The test function
   */
  asPromise(
    name: string,
    fn: (t: Tester, resolve: () => void, reject: (error: unknown) => void) => void
  ): Promise<void>;
  /**
   * Creates a new test that will be run as a promise.
   * Usually used for asynchronous tests that are based on callbacks.
   * @param fn - The test function
   */
  asPromise(
    fn: (t: Tester, resolve: () => void, reject: (error: unknown) => void) => void
  ): Promise<void>;
  /**
   * Creates a new test that will be run as a promise.
   * Usually used for asynchronous tests that are based on callbacks.
   * @param options - The test options
   */
  asPromise(options: TestOptions): Promise<void>;
  /**
   * Creates a new test that will be run as a promise.
   * Usually used for asynchronous tests that are based on callbacks.
   * @param options - The test options
   * @param fn - The test function
   */
  asPromise(
    options: TestOptions,
    fn: (t: Tester, resolve: () => void, reject: (error: unknown) => void) => void
  ): Promise<void>;
}

declare const test: Test;

export {test};
export default test;
