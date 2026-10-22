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

## Reading the result

The exit status is the verdict. Read it first, and read the output only to find what failed.

- `0` — every test passed.
- `1` — the run failed: a failed assertion outside a `todo` test, a bail-out (`t.bailOut()`), a test file that throws while loading, a worker stopped by `TAPE6_WORKER_TIMEOUT`, or "No files found." when the patterns match nothing.

A test file run directly (`node tests/test-foo.js`) exits the same way. A file that throws while loading then prints only Node's error.

A pipe hides the status: `npm test | tail -20` reports the status of `tail`, which is `0`. Run the command on its own and print its status:

```bash
npm test; echo "exit=$?"
```

To shorten long output, set `pipefail` in the same command, so that the pipe reports the status of `npm test`:

````bash
set -o pipefail; npm test 2>&1 | tail -40; echo "exit=$?"
``` The cross-runtime sweep below chains its commands with `&&`, so it stops at the first failure, and `echo "exit=$?"` after it prints that command's status.

Each reporter also marks the end of the run. Judge by that marker, never by the counts: a bail-out stops the run without a failed assertion, so the TTY summary reads `failed: 0` next to `⛔`.

| Reporter      | Selected by          | Passed                                                           | Failed                                                                                 |
| ------------- | -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| TTY (default) | no reporter variable | the summary line starts with `♥️`                                | the summary line starts with `⛔`; failing tests and assertions are marked `✗`         |
| TAP           | `TAPE6_TAP=1`        | `# ok` near the end                                              | `# not ok` near the end; failing assertions read `not ok N`, a bail-out `# bailed out` |
| MIN           | `TAPE6_MIN=1`        | the last line is `Test: 0 Type: end Name: undefined Fail: false` | the same line ends with `Fail: true`                                                   |
| JSONL         | `TAPE6_JSONL=1`      | the last event is `{"type":"end","test":0,"fail":false,…}`       | the same event carries `"fail":true`; `"stopTest":true` marks a run stopped early      |

With the `F` flag (failures only), a green run prints only the summary line, so short output is normal. Under the runner, a file that throws while loading appears as a failed assertion, `✗ Error: …`. For a script that checks the result, set `TAPE6_JSONL=1`: every test's `end` event carries `fail`, and the event's `name` says which test it was. The fixtures in `tests/cli/fixtures/exit-code/` produce each outcome.

## Cross-runtime sweep

Before publishing, run all six matrix points to confirm parity (this is what `release-check` step 15 does):

```bash
npm test && npm run test:bun && npm run test:deno && \
npm run test:seq && npm run test:seq:bun && npm run test:seq:deno
````

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
