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

## Steps

1. Read the testing guide at `node_modules/tape-six/TESTING.md` for API reference and patterns.
2. Identify the module or feature to test. Read its source code to understand the public API.
3. Create or update the test file in `tests/test-<name>.js` (or `.ts` for TypeScript, `.cjs` for CommonJS):
   - **ESM** (`.js`): `import test from 'tape-six'` and import the module under test using the project's package name.
   - **CJS** (`.cjs`): `const {test} = require('tape-six')` and `const {...} = require('my-package')`. Always use `require()` — it is the correct CJS pattern. **Do NOT use `await import()` unless you have confirmed** (e.g., grep for `^await` at the top level) that the module under test uses top-level `await`, which is rare.
   - Write one top-level `test()` per logical group.
   - Use embedded `await t.test()` for sub-cases.
   - Use `t.beforeEach`/`t.afterEach` for shared setup/teardown.
   - Cover: normal operation, edge cases, error conditions.
   - Use `t.equal` for primitives, `t.deepEqual` for objects/arrays, `t.throws` for errors, `await t.rejects` for async errors.
   - All `msg` arguments are optional but recommended for clarity.
4. **Browser-specific tests** — if the project uses browser testing with `tape6-server`. See the "Browser testing" section in `TESTING.md` for full details.
   - Browsers run `.js` and `.mjs` only — no TypeScript, no CommonJS.
   - Browsers can also run `.html` shim files (with inline importmap and `<script type="module">`).
   - Place browser-only files in a subdirectory (e.g., `tests/browser/`) and add patterns to `"browser"` in the `tape6` config.
   - Run: `npx tape6-server --trace`, then open `http://localhost:3000`.
5. **Environment-specific tests** — the `tape6` config in `package.json` supports per-environment patterns (`tests`, `cli`, `node`, `bun`, `deno`, `browser`). All are additive. See "Configuring test discovery" in `TESTING.md`.
6. **Verify (CLI):** run the new test file directly: `node tests/test-<name>.js`
   - Run the full suite to check for regressions: `npm test`
   - If debugging, use `npm run test:seq` (runs sequentially, easier to trace issues).
   - To see which files are being run, add `--flags fo` (overrides the default `--flags FO`).
7. **Verify (browser):** start `npx tape6-server --trace`, then open `http://localhost:3000/?q=/tests/test-<name>.js` to run a specific file. Use multiple `?q=` parameters to run several files. Open `http://localhost:3000/` to run all configured tests.
8. Report results and any failures.
