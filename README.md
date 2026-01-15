# tape-six [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/tape-six.svg
[npm-url]: https://npmjs.org/package/tape-six

`tape-six` is a [TAP](https://en.wikipedia.org/wiki/Test_Anything_Protocol)-based library for unit tests.
It is written in the modern JavaScript for the modern JavaScript and works in [Node](https://nodejs.org/),
[Deno](https://deno.land/), [Bun](https://bun.sh/) and browsers.

Why `tape-six`? It was supposed to be named `tape6` but `npm` does not allow names "similar"
to existing packages. Instead of eliminating name-squatting they force to use unintuitive and
unmemorable names. That's why all internal names, environment variables, and public names still use `tape6`.

## Rationale

Why another library? Working on projects written in modern JS (with modules) I found several problems
with existing unit test libraries:

- In my opinion unit test files should be directly executable with `node`, `deno`, `bun`, browsers
  (with a trivial HTML file to load a test file) without a need for a special test runner utility,
  which wraps and changes my beautiful code.
  - Debugging my tests should be trivial. It should not be different from debugging any regular file.
- The test harness should not obfuscate code nor include hundreds of other packages.
  - I want to debug my code, not dependencies I've never heard about.
  - I want to see where a problem happens, not some guts of a test harness.
- Tests should work with ES modules natively.
  - What if I want to debug some CommonJS code with Node? Fret not! Modules can import CommonJS files directly.
    But not the other way around (yet). And it helps to test how module users can use your beautiful
    CommonJS package.
- The [DX](https://en.wikipedia.org/wiki/User_experience#Developer_experience) in browsers are usually abysmal.
  - Both console-based debugging and a UI to navigate results should be properly supported.

## Docs

The documentation can be found in the [wiki](https://github.com/uhop/tape-six/wiki).
See how it can be used in [tests/](https://github.com/uhop/tape-six/tree/master/tests).

The whole API is based on two objects: `test` and `Tester`.

### `test`

`test` is the entry point to the test suite:

```js
import test from 'tape-six';
```

This function registers a test suite. Available options:

- `async test(name, options, testFn)` &mdash; registers a test suite to be executed asynchronously.
  The returned promise is resolved when the test suite is finished.
  - In most cases no need to wait for the returned promise.
  - The test function has the following signature: `testFn(tester)`
- `test.skip(name, options, testFn)` &mdash; registers a test suite to be skipped.
  - It is used to mark a test suite to be skipped. It will not be executed.
- `test.todo(name, options, testFn)` &mdash; registers a test suite that is marked as work in progress.
  - Tests in this suite will be executed, errors will be reported but not counted as failures.
  - It is used to mark tests for incomplete features under development.
- `test.asPromise(name, options, testPromiseFn)` &mdash; registers a test suite to be executed asynchronously
  using the callback-style API to notify that the test suite is finished.
  - The test function has a different signature: `testPromiseFn(tester, resolve, reject)`.

The arguments mentioned above are:

- `name` &mdash; the optional name of the test suite. If not provided, it will be set to the name of the test function or `'(anonymous)'`.
- `options` &mdash; the optional options object. Available options:
  - `skip` &mdash; if `true`, the test suite will be skipped.
  - `todo` &mdash; if `true`, the test suite will be marked as work in progress.
  - `name` &mdash; the optional name of the test suite. If not provided, it will be set to the name of the test function or `'(anonymous)'`.
    - Can be overridden by the `name` argument.
  - `testFn` &mdash; the optional test function to be executed.
    - Can be overridden by the `testFn` argument.
  - `timeout` &mdash; the optional timeout in milliseconds. It is used for asynchronous tests.
    - If the timeout is exceeded, the test suite will be marked as failed.
    - **Important:** JavaScript does not provide a generic way to cancel asynchronous operations.
      When the timeout is exceeded, `tape6` will stop waiting for the test to finish,
      but it will continue running in the background.
    - The default: no timeout.
  - `testFn` &mdash; the test function to be executed. It will be called with the `tester` object.
    The result will be ignored.
    - This function can be an asynchronous one or return a promise.
  - `testPromiseFn` &mdash; the test function to be executed. It will be called with the `tester` object
    and two callbacks: `resolve` and `reject` modeled on the [Promise API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise).

Given all that `test` and its helpers can be called like this:

```js
test(name, options, testFn);
test(name, testFn);
test(testFn);
test(name, options);
test(options, testFn);
test(options);

// examples:
test('foo', t => {
  t.pass();
});
test('bar', async t => {
  t.fail();
});
test(function baz(t) {
  t.ok(1 < 2);
});
test({
  name: 'qux',
  todo: true,
  testFn: t => {
    t.ok(1 < 2);
  }
});
```

### `Tester`

`Tester` helps to do asserts and provides an interface between a test suite and the test harness.
The following methods are available (all `msg` arguments are optional):

- Asserts:
  - `pass(msg)` &mdash; asserts that the test passed.
  - `fail(msg)` &mdash; asserts that the test failed.
  - `ok(val, msg)` &mdash; asserts that `val` is truthy.
    - `true()` &mdash; an alias of `ok()`.
    - `assert()` &mdash; an alias of `ok()`.
  - `notOk(val, msg)` &mdash; asserts that `val` is falsy.
    - `false()` &mdash; an alias of `notOk()`.
    - `notok()` &mdash; an alias of `notOk()`.
  - `error(err, msg)` &mdash; asserts that `err` is falsy.
    - `ifError()` &mdash; an alias of `error()`.
    - `ifErr()` &mdash; an alias of `error()`.
    - `iferror()` &mdash; an alias of `error()`.
  - `strictEqual(a, b, msg)` &mdash; asserts that `a` and `b` are strictly equal.
    - Strict equality is defined as `a === b`.
    - `is()` &mdash; an alias of `strictEqual()`.
    - `equal()` &mdash; an alias of `strictEqual()`.
    - `isEqual()` &mdash; an alias of `strictEqual()`.
    - `equals()` &mdash; an alias of `strictEqual()`.
    - `strictEquals()` &mdash; an alias of `strictEqual()`.
  - `notStrictEqual(a, b, msg)` &mdash; asserts that `a` and `b` are not strictly equal.
    - `not()` &mdash; an alias of `notStrictEqual()`.
    - `notEqual()` &mdash; an alias of `notStrictEqual()`.
    - `notEquals()` &mdash; an alias of `notStrictEqual()`.
    - `notStrictEquals()` &mdash; an alias of `notStrictEqual()`.
    - `doesNotEqual()` &mdash; an alias of `notStrictEqual()`.
    - `isUnequal()` &mdash; an alias of `notStrictEqual()`.
  - `looseEqual(a, b, msg)` &mdash; asserts that `a` and `b` are loosely equal.
    - Loose equality is defined as `a == b`.
    - `looseEquals()` &mdash; an alias of `looseEqual()`.
  - `notLooseEqual(a, b, msg)` &mdash; asserts that `a` and `b` are not loosely equal.
    - `notLooseEquals()` &mdash; an alias of `notLooseEqual()`.
  - `deepEqual(a, b, msg)` &mdash; asserts that `a` and `b` are deeply equal.
    - Individual components of `a` and `b` are compared recursively using the strict equality.
    - See [deep6's equal()](<https://github.com/uhop/deep6/wiki/equal()>) for details.
    - `same()` &mdash; an alias of `deepEqual()`.
    - `deepEquals()` &mdash; an alias of `deepEqual()`.
    - `isEquivalent()` &mdash; an alias of `deepEqual()`.
  - `notDeepEqual(a, b, msg)` &mdash; asserts that `a` and `b` are not deeply equal.
    - `notSame()` &mdash; an alias of `notDeepEqual()`.
    - `notDeepEquals()` &mdash; an alias of `notDeepEqual()`.
    - `notEquivalent()` &mdash; an alias of `notDeepEqual()`.
    - `notDeeply()` &mdash; an alias of `notDeepEqual()`.
    - `isNotDeepEqual()` &mdash; an alias of `notDeepEqual()`.
    - `isNotEquivalent()` &mdash; an alias of `notDeepEqual()`.
  - `deepLooseEqual(a, b, msg)` &mdash; asserts that `a` and `b` are deeply loosely equal.
    - Individual components of `a` and `b` are compared recursively using the loose equality.
  - `notDeepLooseEqual(a, b, msg)` &mdash; asserts that `a` and `b` are not deeply loosely equal.
  - `throws(fn, msg)` &mdash; asserts that `fn` throws.
    - `fn` is called with no arguments in the global context.
  - `doesNotThrow(fn, msg)` &mdash; asserts that `fn` does not throw.
  - `matchString(string, regexp, msg)` &mdash; asserts that `string` matches `regexp`.
  - `doesNotMatchString(string, regexp, msg)` &mdash; asserts that `string` does not match `regexp`.
  - `match(a, b, msg)` &mdash; asserts that `a` matches `b`.
    - See [deep6's match()](<https://github.com/uhop/deep6/wiki/match()>) for details.
  - `doesNotMatch(a, b, msg)` &mdash; asserts that `a` does not match `b`.
  - `rejects(promise, msg)` &mdash; asserts that `promise` rejects.
    - This is an asynchronous method. It is likely to be waited for.
    - `doesNotResolve()` &mdash; an alias of `rejects()`.
  - `resolves(promise, msg)` &mdash; asserts that `promise` resolves.
    - This is an asynchronous method. It is likely to be waited for.
    - `doesNotReject()` &mdash; an alias of `resolves()`.
- Embedded test suites (all of them are asynchronous and should be waited for):
  - `test(name, options, testFn)` &mdash; runs a test suite asynchronously. See `test()` above.
  - `skip(name, options, testFn)` &mdash; skips a test suite asynchronously. See `test.skip()` above.
  - `todo(name, options, testFn)` &mdash; runs a provisional test suite asynchronously. See `test.todo()` above.
  - `asPromise(name, options, testPromiseFn)` &mdash; runs a test suite asynchronously. See `test.asPromise()` above.
- Miscellaneous:
  - `any` &mdash; returns the `any` object. It can be used in deep equivalency asserts to match any value.
    See [deep6's any](https://github.com/uhop/deep6/wiki/any) for details.
  - `plan(n)` &mdash; sets the number of tests in the test suite. Rarely used.
  - `comment(msg)` &mdash; sends a comment to the test harness. Rarely used.
  - `skipTest(...args, msg)` &mdash; skips the current test yet sends a message to the test harness.
  - `bailOut(msg)` &mdash; stops the test suite and sends a message to the test harness.

In all cases, the `msg` message is optional. If it is not provided, some suitable generic message will be used.

Example:

```js
test('Sample test', async t => {
  const result = await getFromDb({first: 'Bob', last: 'Smith'});
  t.equal(result.position, 'chief bozo', 'the position is correct');
  t.ok(result.manager, 'the manager exists');

  const manager = await getFromDb(result.manager);
  t.ok(manager, 'the manager is retrieved');
  t.equal(manager.first, 'Jane', 'the manager is Jane');
  t.deepEqual(manager.employees, ['Bob Smith'], 'Jane manages only Bob Smith');
});
```

### Running tests

It is super easy to run tests:

1. Install the `tape-six` package: `npm i -D tape-six`
2. Write a test. For example, you named it `test.js`.
3. Run the test: `node test.js`
   1. Or: `bun run test.js`
   2. Or: `deno run -A test.js`
   3. Or you can run them in a browser!
4. Profit!

If you have a lot of tests, you can organize them using multiple files and directories.
`tape-six` provides multiple test runners that can run them in different environments.

### Configuring test runners

See [set-up tests](https://github.com/uhop/tape-six/wiki/Set-up-tests) for details.

### Command-line utilities

- [tape6](https://github.com/uhop/tape-six/wiki/Utility-%E2%80%90-tape6) &mdash; the main utility of the package to run tests in different environments.
- [tape6-server](https://github.com/uhop/tape-six/wiki/Utility-%E2%80%90-tape6-server) &mdash; a custom web server with a web application that helps running tests in browsers.

## Release notes

The most recent releases:

- 1.3.2 _Internal refactoring (capture console calls), updated dependencies._
- 1.3.1 _Bugfix for web browser using JSONL reporter._
- 1.3.0 _Bugfixes, updated dependencies, new feature: proxied console calls._
- 1.2.0 _Updated dependencies + added an optional prefix for JSON lines._
- 1.1.2 _Updated dependencies._
- 1.1.1 _Technical re-release with the missing `index.d.ts` file._
- 1.1.0 _Added TypeScript support._
- 1.0.4 _Bugfix for platform-specific tests, old platforms, minor updates to accommodate Deno 2, updated dev deps._
- 1.0.3 _Minor update to accommodate changes in Bun and updated dev deps._
- 1.0.2 _Bugfix for Deno using the JSONL reporter._
- 1.0.1 _Technical release: added more links._
- 1.0.0 _The first official release._
- 0.12.3 _Technical release: exposed internal classes for external utilities._
- 0.12.2 _Fixed a minor serialization issue._
- 0.12.1 _Minor Deno-related refactoring, fixed the way tests are triggered._
- 0.12.0 _Removed data to avoid serializing non-serializable objects._
- 0.11.0 _Minor improvements to the server: temporary redirects, a hyperlink to the web app._
- 0.10.0 _Refactored test runners, refactored stopping tests on failure, added JSONL reporter, fixed bugs._
- 0.9.6 _Updated deps._
- 0.9.5 _Updated the lock file._
- 0.9.4 _Updated deps. Added test runners for Bun and Deno._
- 0.9.3 _Made TTY reporter work with non-TTY streams._
- 0.9.2 _Fixed Windows runner._
- 0.9.1 _More updates related to renaming `tape6` &rArr; `tape-six`._
- 0.9.0 _Initial release._

For more info consult full [release notes](https://github.com/uhop/tape-six/wiki/Release-notes).
