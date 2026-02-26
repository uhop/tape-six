# tape-six [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/tape-six.svg
[npm-url]: https://npmjs.org/package/tape-six

`tape-six` is a [TAP](https://en.wikipedia.org/wiki/Test_Anything_Protocol)-based library for unit tests.
It is written in the modern JavaScript for the modern JavaScript and works in [Node](https://nodejs.org/), [Deno](https://deno.land/), [Bun](https://bun.sh/) and browsers. **Zero runtime dependencies.**

It runs ES modules (`import`-based code) natively and supports CommonJS modules transparently using the built-in [ESM](https://nodejs.org/api/esm.html).

It can run TypeScript code with modern versions of Node, Bun and Deno **without transpilation**. Obviously TS bindings are included.

Individual test files can be executed directly with `node`, `deno`, `bun` without a need for a special test runner utility. It facilitates debugging and improves testing.

Why `tape-six`? It was supposed to be named `tape6` but `npm` does not allow names "similar"
to existing packages. Instead of eliminating name-squatting they force to use unintuitive and
unmemorable names. That's why all internal names, environment variables, and public names still use `tape6`.

See [examples in the wiki](https://github.com/uhop/tape-six/wiki/Examples).

## Rationale

Why another library? Working on projects written in modern JS (with modules) I found several problems
with existing unit test libraries:

- In my opinion unit test files should be directly executable with Node, Bun, Deno, browsers
  (with a trivial HTML file to load a test file) without a need for a special test runner utility,
  which wraps and changes my beautiful code.
  - Debugging my tests should be trivial. It should not be different from debugging any regular file.
- The test harness should not obfuscate code nor include hundreds of other packages.
  - I want to debug my code, not dependencies I've never heard about.
  - I want to see where a problem happens, not some guts of a test harness.
- Tests should work with ES modules natively.
  - What if I want to debug some CommonJS code with Node? No problem, it just works.
- Tests should work with TypeScript natively.
  - It just works: modern runtimes (Node, Deno, Bun) support running TypeScript natively without transpilation by ignoring type information and running the code directly.
- The [DX](https://en.wikipedia.org/wiki/User_experience#Developer_experience) in browsers are usually abysmal.
  - Both console-based debugging and a UI to navigate results are properly supported.
  - Integration with browser automation tools is supported for automated testing.
    - Examples for [Playwright](https://playwright.dev/) and [Puppeteer](https://pptr.dev/) are provided.

## How it looks

_(The examples below show actual output of test functions. In real life, successful tests are usually hidden and only the final results are shown. Usually failed tests are shown with details and stack traces and the first fail stops testing to speed up the fail-fix cycle. All those details can be configured with settings.)_

Running a test file directly:

```txt
$ node tests/test-console.js
○ console test
  log: log #1
  ✓ pass - 1.542ms
  log: log #2
  err: error #1
  log: log #2a
  ✓ should be truthy - 1.725ms
  log: log #3
  err: error #2
✓ console test  2  0  - 4.747ms
  ♥️   tests: 1, asserts: 2, passed: 2, failed: 0, skipped: 0, todo: 0, time: 6.474ms
```

Running a test suite:

```txt
$ npx tape6 tests/test-console.js tests/test-eval.js
○ FILE: /tests/test-console.js
  ○ console test
    log: log #1
    ✓ pass - 0.338ms
    log: log #2
    err: error #1
    log: log #2a
    ✓ should be truthy - 0.146ms
    log: log #3
    err: error #2
  ✓ console test  2  0  - 1.286ms
✓ FILE: /tests/test-console.js  2  0  - 7.411ms
○ FILE: /tests/test-eval.js
  ○ OK test
    ✓ 1 < 2 - 1.28ms
    ✓ a < b - 0.17ms
    ✓ a + b + c == "3three" - 0.13ms
    ✓ d.a < d.b - 0.105ms
  ✓ OK test  4  0  - 2.695ms
  ○ OK test with self
    ✓ internal check - 0.178ms
    ✓ 1 < 2 - 0.115ms
  ✓ OK test with self  2  0  - 0.55ms
✓ FILE: /tests/test-eval.js  6  0  - 5.756ms
  ♥️   tests: 5, asserts: 8, passed: 8, failed: 0, skipped: 0, todo: 0, time: 108.8ms
```

More colorful versions (click to see the original screenshots):

<img width="240" height="195" alt="image" src="https://github.com/user-attachments/assets/e10c631b-5035-4acb-b411-6af0e9b4041f" />

And:

<img width="240" height="329" alt="image" src="https://github.com/user-attachments/assets/f3d8ac65-9e6a-499d-837f-0271146da1de" />

## Project structure

```
tape-six/
├── index.js          # Main entry point, exports test, hooks, aliases
├── index.d.ts        # TypeScript definitions for the public API
├── package.json      # Package config; "tape6" section configures test discovery
├── bin/              # CLI utilities: tape6, tape6-server, tape6-node, tape6-bun, tape6-deno, tape6-seq
├── src/              # Source code (test engine, reporters, runners, utilities)
├── web-app/          # Browser test UI application
├── tests/            # Test files
├── ts-tests/         # TypeScript test files
├── wiki/             # GitHub wiki documentation (submodule)
└── vendors/          # Git submodules (deep6)
```

## Docs

The documentation can be found in the [wiki](https://github.com/uhop/tape-six/wiki).
See how it can be used in [tests/](https://github.com/uhop/tape-six/tree/master/tests).

For AI assistants: see [llms.txt](https://github.com/uhop/tape-six/blob/master/llms.txt) and [llms-full.txt](https://github.com/uhop/tape-six/blob/master/llms-full.txt) for LLM-optimized documentation.

The whole API is based on two objects: `test` and `Tester`.

### `test`

`test` is the entry point to the test suite:

```js
import test from 'tape-six';
// import {test} from 'tape-six';

// CommonJS:
// const {test} = require('tape-six');
// const {default: test} = require('tape-six');
```

To help port tests from other frameworks, `test()` is aliased as `suite()`, `describe()` and `it()`. When called inside a test body, `test()` and its aliases automatically delegate to the current tester's `t.test()` method. The same applies to `test.skip()`, `test.todo()`, and `test.asPromise()`. Using `t.test()` directly is still preferred because it makes the delegation explicit.

This function registers a test suite. Available options:

- `async test(name, options, testFn)` &mdash; registers a test suite to be executed asynchronously.
  The returned promise is resolved when the test suite is finished.
  - In most cases no need to wait for the returned promise.
  - The test function has the following signature: `async testFn(tester)`
    - The function can be synchronous or asynchronous.
- `async test.skip(name, options, testFn)` &mdash; registers a test suite to be skipped.
  - It is used to mark a test suite to be skipped. It will not be executed.
- `async test.todo(name, options, testFn)` &mdash; registers a test suite that is marked as work in progress.
  - Tests in this suite will be executed, errors will be reported but not counted as failures.
  - It is used to mark tests for incomplete features under development.
- `async test.asPromise(name, options, testPromiseFn)` &mdash; registers a test suite to be executed asynchronously
  using the callback-style API to notify that the test suite is finished.
  - The test function has a different signature: `testPromiseFn(tester, resolve, reject)`.

The arguments mentioned above are:

- `name` &mdash; the optional name of the test suite. If not provided, it will be set to the name of the test function or `'(anonymous)'`.
- `options` &mdash; the optional options object. Available options:
  - `skip` &mdash; if `true`, the test suite will be skipped.
  - `todo` &mdash; if `true`, the test suite will be marked as work in progress.
  - `name` &mdash; the optional name of the test suite. If not provided, it will be set to the name of the test function or `'(anonymous)'`.
    - Can be overridden by the `name` argument.
  - `timeout` &mdash; the optional timeout in milliseconds. It is used for asynchronous tests.
    - If the timeout is exceeded, `tape6` will use the tester's `signal` to indicate cancellation and stop waiting for the test to finish.
    - The default: no timeout.
  - Hooks:
    - `beforeAll` &mdash; a function to be executed before all tests in the suite.
    - `afterAll` &mdash; a function to be executed after all tests in the suite.
    - `beforeEach` &mdash; a function to be executed before each test in the suite.
    - `afterEach` &mdash; a function to be executed after each test in the suite.
    - `before` &mdash; an alias for `beforeAll`.
    - `after` &mdash; an alias for `afterAll`.
  - `testFn` &mdash; the optional test function to be executed (see below).
    - Can be overridden by the `testFn` argument.
  - `testPromiseFn` &mdash; the optional callback-based test function to be executed.
    - Can be overridden by the `testPromiseFn` argument.
- `testFn` &mdash; a test function to be executed. It will be called with the `tester` object.
  The result will be ignored.
  - This function can be synchronous or asynchronous.
- `testPromiseFn` &mdash; a callback-based test function to be executed (see below). It will be called with the `tester` object and two callbacks: `resolve` and `reject` modeled on the [Promise API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise).
  - Value supplied to `resolve()` will be ignored.
  - Value supplied to `reject()` will be used as the error message.

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

Examples of callback-based tests:

```js
test.asPromise(name, options, testPromiseFn);
test.asPromise(name, testPromiseFn);
test.asPromise(testPromiseFn);
test.asPromise(name, options);
test.asPromise(options, testPromiseFn);
test.asPromise(options);

// examples:
test.asPromise('foo', (t, resolve, reject) => {
  t.pass();
  const result = someAsyncOperationAsPromise();
  result.then(resolve).catch(reject);
});

test.asPromise('bar', async (t, resolve, reject) => {
  const nodeStream = fs.createWriteStream('bar.txt');
  nodeStream.on('error', reject);
  nodeStream.on('finish', resolve);
  nodeStream.write('hello');
  nodeStream.end();
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
    - `isNotEqual()` &mdash; an alias of `notStrictEqual()`.
    - `isNot()` &mdash; an alias of `notStrictEqual()`.
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
  - Note: top-level `test()` and its aliases auto-delegate to `t.test()` when called inside a test body. Using `t.test()` directly is preferred.
- Properties:
  - `signal` &mdash; an [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) that fires when the test is aborted (e.g. on timeout or bail-out). Use it to cancel pending async operations.
- Miscellaneous:
  - `any` &mdash; a symbol that can be used in deep equivalency asserts to match any value.
    See [deep6's any](https://github.com/uhop/deep6/wiki/any) for details.
    - `_` &mdash; an alias of `any`.
  - `plan(n)` &mdash; sets the number of tests in the test suite. Rarely used.
  - `comment(msg)` &mdash; sends a comment to the test harness. Rarely used.
  - `skipTest(...args, msg)` &mdash; skips the current test yet sends a message to the test harness.
  - `bailOut(msg)` &mdash; stops the test suite and sends a message to the test harness.
- Evaluators:
  - `OK(condition, msg, options)` &mdash; a high-level helper for evaluating simple expressions.
    - _Available since 1.4.0._
    - See [Tester](https://github.com/uhop/tape-six/wiki/Tester) for description and examples.

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

### Before/after hooks

`tape-six` supports scope-based before/after hooks: `beforeAll`, `afterAll`, `beforeEach`, `afterEach` (with `before`/`after` as aliases for `beforeAll`/`afterAll`), which can be used to set-up and tear-down a proper environment for tests. Like `test()` and its aliases, the top-level hook functions auto-delegate to the current tester when called inside a test body. Using `t.beforeAll()`, etc. is preferred. Read all about it in [before and after hooks](https://github.com/uhop/tape-six/wiki/Before-and-after-hooks).

### Running tests

It is super easy to run tests:

1. Install the `tape-six` package: `npm i -D tape-six`
2. Write a test. For example, you named it `test.js`.
3. Run the test: `node test.js`
   1. Or: `bun run test.js`
   2. Or: `deno run -A test.js` (you can use appropriate permissions).
   3. Or you can run them in a browser!
4. Profit!

If you have a lot of tests, you can organize them using multiple files and directories (see configuration below).
`tape-six` provides multiple test runners that can run them in different environments.

Tests can run in parallel using multiple threads to speed up the whole process.

```bash
tape6         # run tests in parallel using all available threads
tape6 --par 4 # run tests in parallel using 4 threads
tape6 --par 1 # run one test at a time
```

If you want to run tests in separate processes, check out [tape-six-proc](https://www.npmjs.com/package/tape-six-proc). Why do you want to do that? When tests have to modify globals or use single-threaded binary extensions.

If you want to run tests sequentially without expenses of threads and processes, you can use the `tape6-seq` command, which uses the same options and configuration as `tape6`:

```bash
tape6-seq
```

### Configuring test runners

TLDR version &mdash; add to your `package.json`:

```jsonc
{
  // ...
  "scripts": {
    "test": "tape6 --flags FO",
    "start": "tape6-server --trace"
  }
  // ...
  "tape6": {
    "tests": ["/tests/test-*.*js"],
    "importmap": {
      "imports": {
        "tape-six": "/node_modules/tape-six/index.js",
        "tape-six/": "/node_modules/tape-six/src/",
        "my-package": "/index.js",
        "my-package/": "/src/"
      }
    }
  }
}
```

See [set-up tests](https://github.com/uhop/tape-six/wiki/Set-up-tests) for details.

### Command-line utilities

- [tape6](https://github.com/uhop/tape-six/wiki/Utility-%E2%80%90-tape6) &mdash; the main utility of the package to run tests in different environments.
- [tape6-server](https://github.com/uhop/tape-six/wiki/Utility-%E2%80%90-tape6-server) &mdash; a custom web server with a web application that helps running tests in browsers.

Test output can be controlled by flags. See [Supported flags](https://github.com/uhop/tape-six/wiki/Supported-flags) for details.

## Release notes

The most recent releases:

- 1.7.3 _Bug fixes in reporters, runners, and assertions. Documentation corrections and improvements._
- 1.7.2 _Minor internal refactoring and fixes._
- 1.7.1 _Added AI support, added timeout to start test runners, fixed some bugs in the sequential test runner._
- 1.7.0 _New features: after/before hooks for tests, aliases for `suite()`, `describe()`, `it()`, `tape6-seq` &mdash; an in-process sequential test runner. Improvements: stricter monochrome detection, refactoring, bugfixes, updated dev dependencies and the documentation._
- 1.6.0 _New features: support for `AssertionError` and 3rd-party assertion libraries based on it like `node:assert` and `chai`, support for `console.assert()`, support for `signal` to cancel asynchronous operations, tests wait for embedded tests, improved reporting of errors, updated dev dependencies._
- 1.5.1 _Better support for stopping parallel tests, better support for "failed to load" errors._
- 1.5.0 _Internal refactoring (moved state to reporters), added type identification of values in the DOM and TTY reporters, multiple minor fixes._

For more info consult full [release notes](https://github.com/uhop/tape-six/wiki/Release-notes).
