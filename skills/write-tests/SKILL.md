---
name: write-tests
description: Write or update tests using the tape-six testing library. Use when asked to write tests, add test coverage, or create test files for a project that uses tape-six.
---

# Write Tests

Write or update tests using the tape-six testing library.

## Notes

- `tape-six` supports ES modules (`.js`, `.mjs`, `.ts`, `.mts`) and CommonJS (`.cjs`, `.cts`).
- TypeScript is supported natively — no transpilation needed (Node 22+, Deno, Bun run `.ts` files directly).
- The default `tape6` runner uses worker threads for parallel execution. `tape6-seq` runs sequentially in-process — useful for debugging or when tests share state.
- `tape-six` catches `AssertionError` automatically, so you can use Chai or `node:assert` inside tape-six tests if a project already uses them.

## Steps

1. Read the testing guide at `node_modules/tape-six/TESTING.md` for the full API reference and patterns.
2. Identify the module or feature to test. Read its source code to understand the public API.
3. Create or update the test file in `tests/test-<name>.js` (or `.ts` for TypeScript, `.cjs` for CommonJS):
   - **ESM** (`.js`): `import test from 'tape-six'` and import the module under test using the project's package name.
   - **CJS** (`.cjs`): `const {test} = require('tape-six')` and `const {...} = require('my-package')`. Always use `require()` — it is the correct CJS pattern. **Do NOT use `await import()` unless you have confirmed** (e.g., grep for `^await` at the top level) that the module under test uses top-level `await`, which is rare.
   - Write one top-level `test()` per logical group.
   - Use embedded `await t.test()` for sub-cases. **Always `await` embedded tests** to preserve execution order.
   - Use `t.beforeEach`/`t.afterEach` for shared setup/teardown; `t.beforeAll`/`t.afterAll` (aliases `t.before`/`t.after`) for one-shot fixtures.
   - Cover: normal operation, edge cases, error conditions.
   - All `msg` arguments are optional but recommended for clarity.
4. **Pick the right assertion:**
   - Primitives: `t.equal(a, b)` (strict). Use `t.deepEqual(a, b)` for objects/arrays.
   - Truthiness: `t.ok(value)`, `t.notOk(value)`.
   - Errors: `t.error(err)` asserts `err` is falsy (callback-style "no error").
   - Sync throws: `t.throws(fn)`, `t.doesNotThrow(fn)`.
   - Async: `await t.rejects(promise)`, `await t.resolves(promise)`.
   - Strings: `t.matchString(str, /re/)`, `t.doesNotMatchString(str, /re/)`.
   - Structural: `t.match(actual, pattern)` / `t.doesNotMatch(actual, pattern)` for partial object matching (uses deep6 `match()`).
5. **Match error/value shape** (`throws` / `rejects` / `resolves` accept an optional matcher as the second arg):
   ```js
   t.throws(() => parse(''), TypeError);                  // Error subclass
   t.throws(() => parse(''), /unexpected end/);           // RegExp on error.message
   t.throws(() => parse(''), e => e.code === 'EPARSE');   // predicate
   t.throws(() => parse(''), {code: 'EPARSE'});           // deep6 object pattern
   await t.rejects(fetchData(), /404/);
   await t.resolves(fetchData(), {status: 200});          // matches resolved value
   ```
   A string second arg is still treated as the message for backward compatibility.
6. **Wildcards in deep equality** — use `t.any` (alias `t._`) inside expected values to skip non-deterministic fields:
   ```js
   t.deepEqual(result, {id: t.any, name: 'Alice', createdAt: t.any});
   ```
7. **Async cancellation** — `t.signal` is an `AbortSignal` that fires when the test ends, times out, or is stopped. Pass it to long-running async work so it cancels cleanly:
   ```js
   test('aborts on test end', async t => {
     const res = await fetch(url, {signal: t.signal});
     t.equal(res.status, 200);
   });
   ```
8. **Test options** — `test(name, options, fn)` accepts `{timeout, skip, todo, before, after, beforeAll, afterAll, beforeEach, afterEach}`. Use `timeout` (ms) for tests with bounded async work; the test fails and `t.signal` fires when exceeded.
9. **Misc:**
   - `test.skip(name, fn)` / `test.todo(name, fn)` — `skip` doesn't run; `todo` runs but failures don't fail the suite.
   - `t.comment(msg)` — emit a TAP comment line.
   - `t.skipTest(msg)` — skip the *current* test from inside it.
   - `t.bailOut(msg)` — stop the entire run (catastrophic).
   - `t.OK(expr, msg)` (aliases `t.TRUE`, `t.ASSERT`) — returns a code string for `eval()` that asserts an expression and dumps top-level variables on failure. Useful for compact arithmetic/state checks: `eval(t.OK('a + b === 3'))`. Do not use in CSP-restricted contexts.
10. **Browser-specific tests** — if the project uses browser testing with `tape6-server`. See "Browser testing" in `TESTING.md`.
    - Browsers run `.js` and `.mjs` only — no TypeScript, no CommonJS.
    - Browsers can also run `.html` shim files (with inline importmap and `<script type="module">`).
    - Place browser-only files in `tests/browser/` and add patterns to `"browser"` in the `tape6` config.
    - Run: `npx tape6-server --trace`, then open `http://localhost:3000`. Use `?q=<glob>` to filter, `?flags=FO` and `?par=N` to control output and parallelism.
11. **Environment-specific tests** — the `tape6` config in `package.json` supports per-env patterns (`tests`, `cli`, `node`, `bun`, `deno`, `browser`). All are additive. See "Configuring test discovery" in `TESTING.md`.
12. **Verify (CLI):** run the new test file directly: `node tests/test-<name>.js`
    - Run the full suite to check for regressions: `npm test`
    - For debugging, use `npm run test:seq` (sequential, in-process).
    - To see which files are being run, add `--flags fo` (overrides the default `--flags FO`).
    - To inspect the resolved config without running, use `npx tape6 --info`.
    - For tests with heavy `beforeAll` (Docker spawn, big fixture loads), bump the worker startup timer with `TAPE6_WORKER_START_TIMEOUT=60000`. The default is 5 s.
13. **Verify (browser):** start `npx tape6-server --trace`, then open `http://localhost:3000/?q=/tests/test-<name>.js` to run a specific file. Use multiple `?q=` parameters to run several files. Open `http://localhost:3000/` to run all configured tests.
14. Report results and any failures.
