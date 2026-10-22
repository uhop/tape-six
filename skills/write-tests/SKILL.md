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
   - Primitives: `t.equal(a, b)` (strict: `===`, except that `NaN` equals `NaN`). Use `t.deepEqual(a, b)` for objects/arrays.
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
   await t.rejects(fetchData(), /404/);
   await t.resolves(readConfig(), {strict: true}); // deep6 object pattern on the resolved value
   ```
   A string second arg is still treated as the message for backward compatibility. Code can throw any value and reject with any value, not only an `Error`; the matcher sees it as is. An object pattern requires every key it names and doesn't match a class instance, such as an `Error`: check instances by class, RegExp, or predicate. `t.throws` returns the thrown value, and `t.rejects` and `t.resolves` resolve to the reason or the value, so further checks can follow, each reported on its own: `const e = await t.rejects(p); t.equal(e?.code, 'ENOENT');` (the value is `undefined` when the assertion failed).
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
   - `t.skipTest(...args, msg)` — stands in for one assertion: reports it as skipped and does nothing else. To skip an assertion for now, rename it: `t.skipTest(a, b, 'msg')` in place of `t.equal(a, b, 'msg')`. The test goes on, and functions passed to it are not run.
   - `t.bailOut(msg)` — stop the entire run (catastrophic).
   - `t.OK(expr, msg)` (aliases `t.TRUE`, `t.ASSERT`) — returns a code string for `eval()` that asserts an expression and dumps top-level variables on failure. Useful for compact arithmetic/state checks: `eval(t.OK('a + b === 3'))`. Do not use in CSP-restricted contexts.
10. **Testing HTTP code** — the package ships two subpath modules for it:
    - **Server harness** (`tape-six/server.js`) — `withServer(serverHandler, clientHandler, opts?)` for a server scoped to one test, `setupServer(serverHandler, opts?)` for one shared by a suite through `beforeAll`/`afterAll` (it returns a live-getter handle, so don't destructure it at module load), `startServer(server, opts?)` as the procedural primitive, and `record(handler?)`, a recording wrapper. Default host `'127.0.0.1'`. Cross-runtime through `node:http`.
    - **Response helpers** (`tape-six/response.js`) — `asText`, `asJson`, `asBytes`, `header`, and `headers`, working on both a W3C `Response` and Node's `http.IncomingMessage`.
    - To check what a client sent, wrap the handler in `record(handler?)`: it buffers each request as `{method, url, headers, body}` (the body read eagerly as UTF-8) onto its `requests` array, then answers `204` or delegates to `handler`. A delegate reads `entry.body`, its third argument, never the already-drained `req` stream. Assert with `t.match` and `t.any`, and reset between tests with `rec.requests.length = 0` in your own `beforeEach`: `setupServer` owns the lifecycle, the caller owns the state.
      ```js
      import {withServer, record} from 'tape-six/server.js';

      test('the client posts its payload', async t => {
        const rec = record();
        await withServer(rec, async base => {
          await upload(base + '/upload', {a: 1});
        });
        t.match(rec.requests[0], {method: 'POST', url: '/upload', body: '{"a":1}'});
      });
      ```
    - Tests that import `node:http` can't run in a browser; list them under the `"cli"` patterns of the `tape6` config.
11. **Property-based tests** — for a project that uses [fast-check](https://fast-check.dev/), the [`tape-six-fast-check`](https://www.npmjs.com/package/tape-six-fast-check) plugin adds `t.prop()` for properties and `t.scheduler()` for race-condition tests, each reported as one assertion. Without the plugin, call `fc.assert()` inside a plain test.
12. **Browser-specific tests** — if the project uses browser testing with `tape6-server`. See "Browser testing" in `TESTING.md`.
    - Browsers run `.js` and `.mjs` only — no TypeScript, no CommonJS.
    - Browsers can also run `.html` shim files (with inline importmap and `<script type="module">`).
    - A JS test file runs in a `srcdoc` frame whose address is `about:srcdoc`, so code under test that calls `history.replaceState` or `history.pushState` throws there. Test such a page from an `.html` test file, which loads by its real URL.
    - Place browser-only files in `tests/browser/` and add patterns to `"browser"` in the `tape6` config.
    - Run: `npx tape6-server --trace`, then open `http://localhost:3000`. Use `?q=<glob>` to filter, `?flags=FO` and `?par=N` to control output and parallelism.
13. **Environment-specific tests** — the `tape6` config in `package.json` supports per-env patterns (`tests`, `cli`, `node`, `bun`, `deno`, `browser`). All are additive. See "Configuring test discovery" in `TESTING.md`.
14. **Verify (CLI):** run the new test file directly: `node tests/test-<name>.js`
    - Run the full suite to check for regressions: `npm test`
    - For debugging, use `npm run test:seq` (sequential, in-process).
    - To see which files are being run, add `--flags fo` (overrides the default `--flags FO`).
    - To inspect the resolved config without running, use `npx tape6 --info`.
    - For tests with heavy `beforeAll` (Docker spawn, big fixture loads), bump the worker startup timer with `TAPE6_WORKER_START_TIMEOUT=60000`. The default is 5 s.
15. **Verify (browser):** start `npx tape6-server --trace`, then open `http://localhost:3000/?q=/tests/test-<name>.js` to run a specific file. Use multiple `?q=` parameters to run several files. Open `http://localhost:3000/` to run all configured tests.
16. Report results and any failures.
