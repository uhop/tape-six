---
name: write-tests
description: Write or update tape-six tests for a module or feature. Use when asked to write tests, add test coverage, or create test files in this repo.
---

# Write Tests

Write or update tests using the tape-six testing library.

## Notes

- `tape-six` supports ES modules (`.js`, `.mjs`, `.ts`, `.mts`) and CommonJS (`.cjs`, `.cts`).
- TypeScript is supported natively — no transpilation needed (Node 22+, Deno, Bun run `.ts` files directly).
- The default `tape6` runner uses worker threads for parallel execution. `tape6-seq` runs sequentially in-process — useful for debugging or when tests share state.

## Steps

1. Read `TESTING.md` for API reference and patterns.
2. Identify the module/feature to test. Read its source to understand the public API.
3. Create or update `tests/test-<name>.js` (or `.ts` / `.cjs`):
   - **ESM** (`.js`): `import test from '../index.js'` (relative path), not from `tape-six`.
   - **CJS** (`.cjs`): `const {test} = require('../index.js')`. If the module under test uses top-level `await`, use `await import()` inside async tests instead.
   - One top-level `test()` per logical group; embedded `await t.test()` for sub-cases.
   - Use `t.beforeEach`/`t.afterEach` for shared setup/teardown.
   - Cover normal operation, edge cases, and error conditions.
   - Use `t.equal` for primitives, `t.deepEqual` for objects/arrays, `t.throws` for errors, `await t.rejects` for async errors.
4. **Browser-specific tests** — see "Browser testing" in `TESTING.md`.
   - Browsers run `.js`/`.mjs` only (no TS, no CJS), or `.html` shims with importmap.
   - Place browser-only files in `tests/browser/` and add patterns to `"browser"` in the `tape6` config.
   - Run: `npx tape6-server --trace`, then open `http://localhost:3000`.
5. **Environment-specific tests** — `tape6` config in `package.json` supports per-env patterns (`tests`, `cli`, `node`, `bun`, `deno`, `browser`); all additive.
6. **Verify (CLI):** `node tests/test-<name>.js`, then `npm test` for regressions. Use `npm run test:seq` to debug. Add `--flags fo` to see which files run.
7. **Verify (browser):** `npx tape6-server --trace`, then `http://localhost:3000/?q=/tests/test-<name>.js`.
8. Report results and any failures.
