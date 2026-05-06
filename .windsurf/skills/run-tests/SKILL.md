---
name: run-tests
description: Run tape-six's own test suite in this repo. Use when invoking tests, picking between Node/Bun/Deno or parallel/sequential variants, or debugging a failing run.
---

# Run Tests

Invoke tape-six's own test suite or a subset of it. The repo already has all the npm scripts wired — this skill is about choosing the right one.

## What the runner is for

**tape-six test files are directly executable** — `node tests/test-foo.js` (or `bun tests/test-foo.js`, `deno run -A tests/test-foo.js`) works without any runner, no transpilation, no harness wrapping. This is a defining property of tape-six and the fastest path when iterating on one file.

The `tape6` runner / `npm test` script exists for **orchestration**: parallel execution via worker threads, glob-based discovery, per-environment filtering (Node / Bun / Deno / browser), and aggregated reporting. Use them for full-suite runs and CI; bypass them when iterating on a single file.

## Available scripts (`package.json#scripts`)

- **`npm test`** — Node, parallel (default).
- **`npm run test:bun`** / **`npm run test:deno`** — Bun / Deno, parallel.
- **`npm run test:seq`** / **`npm run test:seq:bun`** / **`npm run test:seq:deno`** — sequential, in-process variants. Easier to debug; preserves stack traces.
- **`npm run ts-test`** / **`npm run ts-test:bun`** / **`npm run ts-test:deno`** — runs only the TypeScript test files (`tests/test-*.*ts`). Useful when iterating on `.ts` test changes.
- **`npm run ts-check`** — TypeScript-only typecheck pass (`tsc --noEmit`); complements the runtime test runs.
- **`npm run lint`** — prettier check.

A single file can be run directly without the runner: `node tests/test-foo.js` (or `bun run`, `deno run -A`). Fastest path when iterating on one file; the worker-thread runner adds overhead for single-file runs.

All test scripts pass `--flags FO` by default.

## Default flags

`--flags FO` — **F**ailures only, fail **O**nce (quiet on green, stop on the first red). Lowercase disables, so passing `--flags fo` (via direct invocation) inverts both for a single run (shows passes, continues past failures). Override per-invocation with `TAPE6_FLAGS=...`. The full flag list lives at `wiki/Supported-flags.md`.

## Cross-runtime sweep

Before publishing, run all six matrix points to confirm parity (this is what `release-check` step 15 does):

```bash
npm test && npm run test:bun && npm run test:deno && \
npm run test:seq && npm run test:seq:bun && npm run test:seq:deno
```

If Node passes but Bun fails, run the failing file directly under each runtime to bisect:

```bash
bun tests/test-foo.js
deno run -A tests/test-foo.js
```

## Browser tests

Browser tests live in `tests/browser/` (configured under `tape6.browser` in `package.json`). Start the harness:

```bash
npx tape6-server --trace
```

Then open `http://localhost:3000/` (all browser tests) or `http://localhost:3000/?q=/tests/browser/test-foo.js` (single file). Query parameters: `?flags=FO`, `?par=N`.

## Debugging tips

- **Sequential** (`npm run test:seq`) gives clean stack traces and avoids worker-thread overhead.
- **Inspect resolved config** without running: `npx tape6 --info`.
- **Heavy `beforeAll`** (Docker spawn, large fixture loads): set `TAPE6_WORKER_START_TIMEOUT=60000` (default 5 s).
- **See which files are being picked up**: invert one flag with `node ./bin/tape6.js --flags fo` (lowercase shows passes too).

## Further reading

- `wiki/Set-up-tests.md` — full `tape6` config block reference.
- `wiki/Supported-flags.md` — every flag, every override layer.
- `wiki/Utility-‐-tape6.md` — env vars (`TAPE6_FLAGS`, `TAPE6_PAR`, `TAPE6_WORKER_START_TIMEOUT`), parallelism control.
- `wiki/Utility-‐-tape6‐server.md` — browser harness query parameters, dev-time path mounts.
- `wiki/Environment-‐-{Node,Bun,Deno,Browsers}.md` — runtime-specific guidance.
- `TESTING.md` — top-level testing guide (also shipped to consumers).
