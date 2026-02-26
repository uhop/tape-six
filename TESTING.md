# Testing with tape-six

> This guide is for AI agents and developers working on projects that use `tape-six` for testing.
> It covers how to write tests, run them, and configure test discovery.

`tape-six` supports ES modules and CommonJS. TypeScript is supported natively — no transpilation needed (Node 22+, Deno, Bun all run `.ts` files directly).

## Install

```bash
npm i -D tape-six
```

## Quick start

Create a test file (e.g., `tests/test-example.js`):

```js
import test from 'tape-six';

test('arithmetic', t => {
  t.equal(2 + 2, 4, 'addition');
  t.ok(10 > 5, 'comparison');
  t.deepEqual({a: 1}, {a: 1}, 'deep equality');
});
```

Run it directly:

```bash
node tests/test-example.js
```

Run all configured tests:

```bash
npx tape6 --flags FO
```

## Writing tests

### Importing

ES modules (`.js`, `.mjs`, `.ts`, `.mts`):

```js
import test from 'tape-six';
// or named imports:
import {test, describe, it, beforeAll, afterAll, beforeEach, afterEach} from 'tape-six';
```

CommonJS (`.cjs`, `.cts`):

```js
const {test} = require('tape-six');
```

### Registering tests

`test(name, options, testFn)` — all arguments are optional, recognized by type.

```js
test('name', t => {
  t.pass('unconditional pass');
});

test('async test', async t => {
  const result = await fetchData();
  t.equal(result.status, 200, 'status OK');
});
```

Aliases: `suite()`, `describe()`, `it()` — all identical to `test()`.

When called inside a test body, top-level functions (`test`, `it`, `describe`, and all hooks) automatically delegate to the current tester. Using `t.test()`, `t.before()`, etc. is still preferred because it makes the delegation explicit. The top-level form is convenient when porting tests from frameworks like Mocha or Jest:

```js
import {describe, it, before, beforeEach} from 'tape-six';

describe('module', () => {
  before(() => { /* setup — same as t.before() */ });
  beforeEach(() => { /* per-test setup */ });

  it('works', t => {
    t.ok(true);
  });

  it('also works', t => {
    t.equal(1 + 1, 2);
  });
});
```

### Skip and TODO

```js
test.skip('not ready', t => { t.fail(); });           // skipped entirely
test.todo('in progress', t => { t.equal(1, 2); });    // runs, failures not counted
```

### Assertions

All `msg` arguments are optional. If omitted, a generic message is used.

| Method | Checks | Common aliases |
|---|---|---|
| `t.pass(msg)` | Unconditional pass | |
| `t.fail(msg)` | Unconditional fail | |
| `t.ok(val, msg)` | `val` is truthy | `true`, `assert` |
| `t.notOk(val, msg)` | `val` is falsy | `false`, `notok` |
| `t.error(err, msg)` | `err` is falsy | `ifError`, `ifErr` |
| `t.equal(a, b, msg)` | `a === b` | `is`, `strictEqual`, `isEqual` |
| `t.notEqual(a, b, msg)` | `a !== b` | `not`, `notStrictEqual`, `isNot` |
| `t.deepEqual(a, b, msg)` | Deep strict equality | `same`, `isEquivalent` |
| `t.notDeepEqual(a, b, msg)` | Not deeply equal | `notSame`, `notEquivalent` |
| `t.looseEqual(a, b, msg)` | `a == b` | |
| `t.notLooseEqual(a, b, msg)` | `a != b` | |
| `t.deepLooseEqual(a, b, msg)` | Deep loose equality | |
| `t.notDeepLooseEqual(a, b, msg)` | Not deeply loosely equal | |
| `t.throws(fn, msg)` | `fn()` throws | |
| `t.doesNotThrow(fn, msg)` | `fn()` does not throw | |
| `t.matchString(str, re, msg)` | `str` matches `re` | |
| `t.doesNotMatchString(str, re, msg)` | `str` doesn't match `re` | |
| `t.match(a, b, msg)` | Structural pattern match | |
| `t.doesNotMatch(a, b, msg)` | No structural match | |
| `t.rejects(promise, msg)` | Promise rejects (**await it**) | `doesNotResolve` |
| `t.resolves(promise, msg)` | Promise resolves (**await it**) | `doesNotReject` |

### Async assertions

`rejects` and `resolves` are async — always `await` them:

```js
test('async asserts', async t => {
  await t.rejects(Promise.reject(new Error('fail')), 'should reject');
  await t.resolves(Promise.resolve(42), 'should resolve');
});
```

### Nested (embedded) tests

Tests can be nested. The preferred way is `t.test()` because it makes the delegation explicit. Top-level `test()`/`it()` are equivalent inside a test body — they auto-delegate to the current tester:

```js
import {test, it} from 'tape-six';

test('suite', async t => {
  // these two forms are equivalent:
  await t.test('using t.test', t => {
    t.pass();
  });

  await it('using top-level it()', t => {
    t.ok(true);
  });
});
```

Embedded tests must be `await`ed to preserve execution order.

### Hooks (setup/teardown)

Hooks are scoped — they only affect tests at their registration level.

`before` is an alias for `beforeAll`, `after` is an alias for `afterAll`. These aliases work everywhere: as named exports, on `test.before`/`test.after`, on `t.before`/`t.after`, and in options objects.

**Top-level hooks** (affect all top-level tests in the file):

```js
import {test, beforeAll, afterAll, beforeEach, afterEach} from 'tape-six';
// or with aliases:
import {test, before, after, beforeEach, afterEach} from 'tape-six';

beforeAll(() => { /* once before first test */ });
afterAll(() => { /* once after last test */ });
beforeEach(() => { /* before each test */ });
afterEach(() => { /* after each test */ });
```

**Nested hooks** (affect embedded tests within a suite):

The preferred way is `t.before()`/`t.after()` because it makes the scope explicit. Top-level `before()`/`after()` are equivalent inside a test body — they auto-delegate to the current tester:

```js
import {test, before, after, beforeEach} from 'tape-six';

test('database tests', async t => {
  let db;
  // these use top-level functions — they auto-delegate to t:
  before(async () => { db = await connect(); });
  after(async () => { await db.close(); });
  beforeEach(() => { /* reset state */ });

  // equivalent using t. methods:
  // t.before(async () => { db = await connect(); });
  // t.after(async () => { await db.close(); });
  // t.beforeEach(() => { /* reset state */ });

  await t.test('insert', async t => {
    const result = await db.insert({name: 'Alice'});
    t.ok(result.id, 'got an id');
  });

  await t.test('query', async t => {
    const rows = await db.query('SELECT * FROM users');
    t.ok(rows.length > 0, 'has rows');
  });
});
```

**Hooks via options** (reusable across tests):

```js
const dbOpts = {
  beforeEach: () => resetFixtures(),
  afterEach: () => cleanupDb()
};

test('suite A', dbOpts, async t => { /* ... */ });
test('suite B', dbOpts, async t => { /* ... */ });
```

## Migrating from other test frameworks

`tape-six` supports `describe`/`it` and `before`/`after` aliases. When called inside a test body, all top-level functions automatically delegate to the current tester. This means migration from Mocha, Jest, or `node:test` is nearly mechanical — change the import and swap assertions.

### Mocha / Jest → tape-six

```js
// Mocha / Jest
describe('module', () => {
  before(() => { /* setup */ });
  after(() => { /* teardown */ });
  beforeEach(() => { /* per-test setup */ });

  it('works', () => { expect(1).toBe(1); });
});
```

```js
// tape-six — just change the import and swap assertions
import {describe, it, before, after, beforeEach} from 'tape-six';

describe('module', () => {
  before(() => { /* setup */ });
  after(() => { /* teardown */ });
  beforeEach(() => { /* per-test setup */ });

  it('works', t => { t.equal(1, 1); });
});
```

Key differences from Mocha/Jest:
- **Assertions** use `t.equal`, `t.deepEqual`, etc. instead of `expect`.
- The test function receives a `t` argument for assertions.
- No magic globals — everything is imported explicitly.
- `it()` inside `describe()` is auto-delegated, no need to use `t.test()`.
- `before()`/`after()` inside `describe()` are auto-delegated, no need to use `t.before()`/`t.after()`.

### Chai → tape-six

Chai is commonly used with Mocha and other test frameworks. Its `expect`/`should`/`assert` styles all throw `AssertionError`, which `tape-six` catches automatically. You can use Chai assertions directly inside `tape-six` tests, or replace them with `t.*` equivalents:

```js
// Chai expect style
import {expect} from 'chai';

describe('module', () => {
  it('works', () => {
    expect(1 + 1).to.equal(2);
    expect([1, 2]).to.deep.equal([1, 2]);
    expect(true).to.be.ok;
    expect(() => badFn()).to.throw();
  });
});
```

```js
// tape-six — Chai assertions work as-is, or replace with t.*
import {describe, it} from 'tape-six';

describe('module', () => {
  it('works', t => {
    t.equal(1 + 1, 2);
    t.deepEqual([1, 2], [1, 2]);
    t.ok(true);
    t.throws(() => badFn());
  });
});
```

You can also keep Chai alongside `tape-six` — failures are reported correctly either way:

```js
import {describe, it} from 'tape-six';
import {expect} from 'chai';

describe('mixed assertions', () => {
  it('uses both', t => {
    expect(1).to.be.lessThan(2);      // Chai — caught automatically
    t.equal(1 + 1, 2);                // tape-six native
  });
});
```

### node:test → tape-six

```js
// node:test
import {describe, it, before, after} from 'node:test';
import assert from 'node:assert/strict';

describe('module', () => {
  before(() => { /* setup */ });
  it('works', () => { assert.equal(1, 1); });
});
```

```js
// tape-six — change import, optionally swap assert for t.*
import {describe, it, before} from 'tape-six';

describe('module', () => {
  before(() => { /* setup */ });
  it('works', t => { t.equal(1, 1); });
});
```

Note: you can also keep using `node:assert` inside tape-six tests — `AssertionError` is caught automatically (see [3rd-party assertion libraries](#3rd-party-assertion-libraries)).

### Quick reference

| Mocha / Jest / node:test | tape-six equivalent |
|---|---|
| `describe(name, fn)` | `describe(name, fn)` — same |
| `it(name, fn)` | `it(name, t => { ... })` — same, but receives `t` |
| `before(fn)` | `before(fn)` — same (alias for `beforeAll`) |
| `after(fn)` | `after(fn)` — same (alias for `afterAll`) |
| `beforeEach(fn)` | `beforeEach(fn)` — same |
| `afterEach(fn)` | `afterEach(fn)` — same |
| `expect(a).toBe(b)` | `t.equal(a, b)` |
| `expect(a).toEqual(b)` | `t.deepEqual(a, b)` |
| `expect(a).toBeTruthy()` | `t.ok(a)` |
| `expect(fn).toThrow()` | `t.throws(fn)` |
| `assert.equal(a, b)` | `t.equal(a, b)` or keep `assert.equal` |
| `assert.deepEqual(a, b)` | `t.deepEqual(a, b)` or keep `assert.deepEqual` |
| `expect(a).to.equal(b)` (Chai) | `t.equal(a, b)` or keep `expect` |
| `expect(a).to.deep.equal(b)` (Chai) | `t.deepEqual(a, b)` or keep `expect` |
| `expect(a).to.be.ok` (Chai) | `t.ok(a)` or keep `expect` |
| `expect(fn).to.throw()` (Chai) | `t.throws(fn)` or keep `expect` |

### Wildcard matching with `t.any`

Use `t.any` (or `t._`) in deep equality checks to match any value:

```js
test('partial match', t => {
  const result = {id: 123, name: 'Alice', createdAt: new Date()};
  t.deepEqual(result, {id: 123, name: 'Alice', createdAt: t.any});
});
```

### Testing exceptions

```js
test('errors', async t => {
  t.throws(() => { throw new Error('boom'); }, 'should throw');
  t.doesNotThrow(() => 42, 'should not throw');
  await t.rejects(Promise.reject(new Error('fail')), 'should reject');
  await t.resolves(Promise.resolve(42), 'should resolve');
});
```

### 3rd-party assertion libraries

`tape-six` catches `AssertionError` automatically. You can use `chai` or `node:assert`:

```js
import test from 'tape-six';
import {expect} from 'chai';

test('with chai', t => {
  expect(1).to.be.lessThan(2);
  expect([1, 2]).to.deep.equal([1, 2]);
});
```

```js
import test from 'tape-six';
import assert from 'node:assert/strict';

test('with node:assert', t => {
  assert.equal(1 + 1, 2);
  assert.deepEqual({a: 1}, {a: 1});
});
```

## Running tests

### Single file

```bash
node tests/test-example.js            # Node.js
bun run tests/test-example.js         # Bun
deno run -A tests/test-example.js     # Deno
```

### All configured tests

```bash
npx tape6 --flags FO                  # parallel (worker threads)
npx tape6-seq --flags FO              # sequential (in-process, no workers)
npx tape6 --par 4 --flags FO          # limit to 4 workers
```

**`tape6` vs `tape6-seq`**: The default `tape6` runner spawns worker threads to run test files in parallel — faster, but each file runs in its own isolated context. `tape6-seq` runs all test files sequentially in a single process — slower, but useful for debugging, for tests that share state, or when worker threads are unavailable.

### Selected test files

```bash
npx tape6 --flags FO tests/test-foo.js tests/test-bar.js
npx tape6-seq --flags FO tests/test-foo.js tests/test-bar.js
```

### Typical package.json scripts

```json
{
  "scripts": {
    "test": "tape6 --flags FO",
    "test:bun": "tape6-bun --flags FO",
    "test:deno": "tape6-deno --flags FO",
    "test:seq": "tape6-seq --flags FO",
    "test:seq:bun": "bun run `tape6-seq --self` --flags FO",
    "test:seq:deno": "deno run -A `tape6-seq --self` --flags FO"
  }
}
```

### Flags

Flags control test output. Uppercase = enabled, lowercase = disabled.

| Flag | Meaning |
|---|---|
| `F` | **F**ailures only — hide passing tests |
| `O` | Fail **o**nce — stop at first failure |
| `T` | Show **t**ime for each test |
| `D` | Show **d**ata of failed tests |
| `B` | Show **b**anner with summary |
| `N` | Show assert **n**umber |
| `M` | **M**onochrome — no colors |
| `C` | Don't **c**apture console output |
| `H` | **H**ide streams and console output |

Common combinations: `FO` (failures only + stop at first), `FOT` (+ show time).

### Environment variables

- `TAPE6_FLAGS` — flags string (alternative to `--flags`).
- `TAPE6_PAR` — number of parallel workers.
- `TAPE6_TAP` — force TAP output format.
- `TAPE6_JSONL` — force JSONL output format.

## Configuring test discovery

Add to `package.json`:

```json
{
  "tape6": {
    "tests": ["/tests/test-*.*js"],
    "importmap": {
      "imports": {
        "tape-six": "/node_modules/tape-six/index.js",
        "tape-six/": "/node_modules/tape-six/src/",
        "my-package": "/src/index.js",
        "my-package/": "/src/"
      }
    }
  }
}
```

- `tests` — glob patterns for test files (relative to project root with leading `/`). Common for all environments.
- `cli` — additional patterns for CLI-only environments (Node, Bun, Deno). Typically used for `.cjs` files.
- `node`, `deno`, `bun`, `browser` — additional patterns specific to a given environment. These are **not overrides** — they are added to `tests` (and `cli` for non-browser).
- `importmap` — import map for browser testing (standard [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) format).

Example with environment-specific tests:

```json
{
  "tape6": {
    "node": ["/tests/node/test-*.js"],
    "deno": ["/tests/deno/test-*.js"],
    "browser": ["/tests/web/test-*.html"],
    "tests": ["/tests/test-*.*js"],
    "importmap": {
      "imports": {
        "tape-six": "/node_modules/tape-six/index.js",
        "tape-six/": "/node_modules/tape-six/src/"
      }
    }
  }
}
```

In this example, running `tape6` on Node will execute tests matching `/tests/node/test-*.js` + `/tests/test-*.*js`. Running in a browser will execute `/tests/web/test-*.html` + `/tests/test-*.*js`.

## Browser testing

Browser tests use `tape6-server`, a static file server bundled with `tape-six` that provides a web UI for running tests.

### Setup

1. Configure `importmap` in `package.json` so the browser can resolve bare imports:

```json
{
  "tape6": {
    "tests": ["/tests/test-*.*js"],
    "browser": ["/tests/web/test-*.html"],
    "importmap": {
      "imports": {
        "tape-six": "/node_modules/tape-six/index.js",
        "tape-six/": "/node_modules/tape-six/src/",
        "my-package": "/src/index.js",
        "my-package/": "/src/"
      }
    }
  }
}
```

2. Start the server:

```bash
npx tape6-server --trace
```

3. Open `http://localhost:3000` in a browser to see the web UI and run all configured tests.

### Running all configured browser tests

Navigate to:

```
http://localhost:3000/
```

The web app fetches the configured test list from the server and runs them.

### Running specific test files by name

Use the `?q=` query parameter (supports multiple values):

```
http://localhost:3000/?q=/tests/test-foo.js&q=/tests/test-bar.js
```

These are glob patterns resolved by the server, so wildcards work:

```
http://localhost:3000/?q=/tests/test-sample.*js
```

### Running a single test file (HTML shim)

Create an HTML file that loads test scripts directly with an inline import map:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My tests</title>
    <script type="importmap">
      {
        "imports": {
          "tape-six": "/node_modules/tape-six/index.js",
          "tape-six/": "/node_modules/tape-six/src/"
        }
      }
    </script>
    <script type="module" src="../test-sample.js"></script>
  </head>
  <body>
    <h1>My tests</h1>
    <p>See the console.</p>
  </body>
</html>
```

Navigate to the HTML file directly (e.g., `http://localhost:3000/tests/web/test-simple.html`). Results appear in the browser console. This approach does not use the web UI.

### Flags and parallel execution in the browser

Append query parameters:

```
http://localhost:3000/?flags=FO&par=3
```

### Browser automation

Use Puppeteer or Playwright to run browser tests from the command line:

```js
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({headless: true});
const page = await browser.newPage();
page.on('console', msg => console.log(msg.text()));
await page.exposeFunction('__tape6_reportResults', async text => {
  await browser.close();
  process.exit(text === 'success' ? 0 : 1);
});
await page.goto('http://localhost:3000/?flags=M');
```

### Browser limitations

- Browsers cannot run TypeScript files directly — only `.js` and `.mjs`.
- Browsers cannot run CommonJS (`.cjs`) files.
- Browsers can run HTML shim files in addition to JS files.

## Test file conventions

- **Naming**: `test-*.js`, `test-*.mjs`, `test-*.cjs`, `test-*.ts`, `test-*.mts`, `test-*.cts`.
- **Location**: typically `tests/` directory.
- **Self-contained**: each test file should be directly executable with `node`.
- **One concern per file**: group related tests in a single file, use embedded tests for sub-grouping.

## Patterns for AI agents writing tests

### Testing a new function

```js
import test from 'tape-six';
import {myFunction} from 'my-package/my-module.js';

test('myFunction', async t => {
  await t.test('returns correct result for basic input', t => {
    t.deepEqual(myFunction(1, 2), {sum: 3, product: 2});
  });

  await t.test('handles edge cases', t => {
    t.deepEqual(myFunction(0, 0), {sum: 0, product: 0});
    t.throws(() => myFunction(null), 'throws on null input');
  });

  await t.test('async variant', async t => {
    const result = await myFunction.async(1, 2);
    t.equal(result.sum, 3);
  });
});
```

### Testing a class

```js
import test from 'tape-six';
import {MyClass} from 'my-package/my-class.js';

test('MyClass', async t => {
  let instance;
  t.beforeEach(() => { instance = new MyClass(); });

  await t.test('constructor', t => {
    t.ok(instance, 'creates instance');
    t.equal(instance.size, 0, 'starts empty');
  });

  await t.test('add', t => {
    instance.add('item');
    t.equal(instance.size, 1, 'size increases');
  });

  await t.test('remove', t => {
    instance.add('item');
    instance.remove('item');
    t.equal(instance.size, 0, 'size decreases');
  });
});
```

### Verifying after writing tests

```bash
node tests/test-<name>.js    # run your new test file directly
npm test                      # run full suite to check for regressions
```

## Links

- Full API reference: https://github.com/uhop/tape-six/wiki/Tester
- Hooks documentation: https://github.com/uhop/tape-six/wiki/Before-and-after-hooks
- Configuration: https://github.com/uhop/tape-six/wiki/Set-up-tests
- Supported flags: https://github.com/uhop/tape-six/wiki/Supported-flags
- npm: https://www.npmjs.com/package/tape-six
