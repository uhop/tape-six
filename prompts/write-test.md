Write tests for the specified feature or module using the `tape-six` testing library.

Before writing tests:
1. Review the feature's source code to understand its public API, edge cases, and error conditions
2. Review `index.js` and `index.d.ts` for exports and type signatures
3. Check existing test files in `tests/` for style and conventions
4. Review `AGENTS.md` for project conventions

## File conventions

- **JavaScript tests:** place in `tests/` with the naming pattern `test-<feature>.js`
- **TypeScript tests:** place in `ts-tests/` with the naming pattern `test-<feature>.ts`
- Import from `../index.js` (relative path), not from `tape-six` — this applies to both JS and TS files
- One file per feature or logical group of related functionality

## Import style

Use the default import for simple tests:

```js
import test from '../index.js';
```

If you need hooks, import them as named exports:

```js
import {test, beforeAll, afterAll, beforeEach, afterEach} from '../index.js';
```

If you use `describe`/`it` style:

```js
import {describe, it} from '../index.js';
```

## TypeScript notes

- TypeScript tests use the same imports and the same code style as JavaScript tests
- Import from `../index.js` (not `../index.ts`) — types are provided by `index.d.ts` automatically
- Do not add explicit type annotations for the tester object (`t`) — it is inferred
- Modern Node, Bun, and Deno run `.ts` files directly without transpilation
- In TS hook callbacks that use expressions (e.g., `++counter`), prefix with `void` to satisfy the `() => void` return type:

```ts
beforeAll(() => void ++counter);
afterAll(() => void --counter);
```

## Writing assertions

- Use the canonical method names: `t.ok()`, `t.equal()`, `t.deepEqual()`, `t.throws()`, `t.rejects()`
- Always provide a descriptive message as the last argument: `t.equal(result, 42, 'should return 42')`
- Use `t.ok()` for truthy checks, `t.equal()` for strict equality, `t.deepEqual()` for objects/arrays
- Use `t.throws()` for synchronous errors, `await t.rejects()` for async errors
- Use `t.any` (or `t._`) as a wildcard in `t.deepEqual()` when some values are non-deterministic
- Use `eval(t.OK('expression'))` for expression-based assertions where seeing variable values on failure is helpful

## Test structure

- Each `test()` call should focus on one behavior or scenario
- Use descriptive test names that explain what is being tested
- Use `async` test functions when testing async code or using embedded tests
- Always `await` embedded tests (`await t.test(...)`) to preserve execution order
- Use `test.skip()` for tests that are not yet ready
- Use `test.todo()` for tests for features under development

## Patterns

Basic test:

```js
test('feature name - specific behavior', t => {
  const result = myFunction(input);
  t.equal(result, expected, 'description of expectation');
});
```

Async test:

```js
test('async operation', async t => {
  const result = await asyncFunction();
  t.ok(result, 'got a result');
  t.equal(result.status, 'ok', 'status is ok');
});
```

Nested tests with setup/teardown:

```js
test('feature group', async t => {
  let resource;
  t.beforeAll(async () => { resource = await setup(); });
  t.afterAll(async () => { await resource.close(); });

  await t.test('scenario 1', t => {
    t.ok(resource.isReady(), 'resource is ready');
  });

  await t.test('scenario 2', t => {
    t.equal(resource.state, 'active', 'resource is active');
  });
});
```

Testing exceptions:

```js
test('error handling', async t => {
  t.throws(() => { badFunction(); }, 'should throw on bad input');
  t.doesNotThrow(() => { goodFunction(); }, 'should not throw on good input');
  await t.rejects(asyncBadFunction(), 'should reject on bad async input');
  await t.resolves(asyncGoodFunction(), 'should resolve on good async input');
});
```

## Verification

After writing the test file, verify it:
1. Run directly: `node tests/test-<feature>.js` (or `node ts-tests/test-<feature>.ts` for TypeScript)
2. Run with flags: `TAPE6_FLAGS=FO node tests/test-<feature>.js`
3. Ensure it is picked up by the test runner:
   - JS tests: `npm test` — files must match globs in `package.json` under `tape6.tests`
   - TS tests: `npm run ts-test` — runs `tape6 --flags FO '/ts-tests/test-*.ts'`

## Code style

- Follow Prettier formatting (no semicolons — match existing files)
- No unnecessary imports or dependencies
- Keep tests concise and focused
- Do not add comments unless they explain non-obvious test logic
