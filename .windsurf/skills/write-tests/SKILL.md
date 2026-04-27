---
name: write-tests
description: Write or update tape-six tests for a module or feature. Use when asked to write tests, add test coverage, or create test files in this repo.
---

# Write Tests

Write or update tape-six tests for a module or feature in this repository.

## Notes

- This is the tape-six source repository — tests import from `../index.js` (relative), not from `tape-six` (the consumer-facing form lives in `skills/write-tests/SKILL.md`).
- Test files live in `tests/`. Naming: `test-*.js`, `test-*.mjs`, `test-*.cjs`, `test-*.ts`, `test-*.mts`, `test-*.cts`.
- TypeScript runs natively (Node 22+, Deno, Bun) — no transpilation.
- Default `tape6` runner uses worker threads. `tape6-seq` runs sequentially in-process — easier to debug.
- `tape-six` catches `AssertionError` automatically, so Chai or `node:assert` work inside tests if useful.

## Steps

1. Read `TESTING.md` for the full API reference and patterns.
2. Identify the module or feature to test. Read its source (`src/...`) to understand the API.
3. Create or update the test file in `tests/test-<name>.js` (or `.ts` / `.cjs`):
   - **ESM** (`.js`): `import test from '../index.js'`. Import the module under test with a relative path.
   - **CJS** (`.cjs`): `const {test} = require('../index.js')`. If the module under test uses top-level `await`, use `await import()` inside async tests instead.
   - One top-level `test()` per logical group; embedded `await t.test()` for sub-cases. Always `await` embedded tests.
   - Use `t.beforeEach`/`t.afterEach` for shared setup/teardown; `t.beforeAll`/`t.afterAll` (aliases `t.before`/`t.after`) for one-shot fixtures.
   - Cover normal operation, edge cases, and error conditions.
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
   t.throws(() => parse(''), TypeError); // Error subclass
   t.throws(() => parse(''), /unexpected end/); // RegExp on error.message
   t.throws(
     () => parse(''),
     e => e.code === 'EPARSE'
   ); // predicate
   t.throws(() => parse(''), {code: 'EPARSE'}); // deep6 object pattern
   await t.rejects(fetchData(), /404/);
   await t.resolves(fetchData(), {status: 200}); // matches resolved value
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
   - `t.skipTest(msg)` — skip the _current_ test from inside it.
   - `t.bailOut(msg)` — stop the entire run (catastrophic).
   - `t.OK(expr, msg)` (aliases `t.TRUE`, `t.ASSERT`) — returns a code string for `eval()` that asserts an expression and dumps top-level variables on failure. Useful for compact arithmetic/state checks: `eval(t.OK('a + b === 3'))`. Do not use in CSP-restricted contexts.
10. **Testing HTTP code** — the package exports two subpath modules; in this repo import them via the relative path:
    - **Server harness** (`../src/server.js`) — `withServer(serverHandler, clientHandler, opts?)` per-test scoped, `setupServer(serverHandler, opts?)` for suite-shared via `beforeAll`/`afterAll` (returns live-getter handle — don't destructure at module load), `startServer(server, opts?)` procedural primitive. Default host `'127.0.0.1'`. Cross-runtime via `node:http`.
    - **Response helpers** (`../src/response.js`) — `asText`/`asJson`/`asBytes`/`header`/`headers` working on both W3C `Response` and Node `http.IncomingMessage`.
    - For mock-server scenarios that record requests: compose your own `beforeEach` to reset state. `setupServer` owns the lifecycle; the caller owns state.
    - Reference tests: `tests/test-server.js`, `tests/test-response.js`.
11. **Browser-specific tests** — see "Browser testing" in `TESTING.md`.
    - Browsers run `.js`/`.mjs` only (no TS, no CJS), or `.html` shims with importmap.
    - Place browser-only files in `tests/browser/` and add patterns to `"browser"` in the `tape6` config.
    - Run: `npx tape6-server --trace`, then open `http://localhost:3000`. Use `?q=<glob>` to filter, `?flags=FO` and `?par=N` to control output and parallelism.
12. **Environment-specific tests** — the `tape6` config in `package.json` supports per-env patterns (`tests`, `cli`, `node`, `bun`, `deno`, `browser`); all additive.
13. **Verify (CLI):** `node tests/test-<name>.js`, then `npm test` for regressions. Use `npm run test:seq` to debug. Add `--flags fo` to see which files run. Use `npx tape6 --info` to inspect resolved config without running tests. For tests with heavy `beforeAll`, set `TAPE6_WORKER_START_TIMEOUT=60000` (default 5 s).
14. **Verify (browser):** `npx tape6-server --trace`, then `http://localhost:3000/?q=/tests/test-<name>.js`.
15. Report results and any failures.
