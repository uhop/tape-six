---
name: run-tests
description: Set up `npm test` and run tape-six tests for a project. Use when configuring a project's test scripts in package.json, picking a runner, or debugging test invocation.
---

# Run Tests

Configure and invoke tape-six tests for a project that uses `tape-six`.

## What the runner is for

**tape-six test files are directly executable** — `node tests/test-foo.js` (or `bun tests/test-foo.js`, `deno run -A tests/test-foo.js`) works without any runner, no transpilation, no harness wrapping the test code. This is a defining property of tape-six.

The `tape6` runner exists only for **orchestration**: parallel execution via worker threads, glob-based test discovery, per-environment filtering (Node / Bun / Deno / browser), and aggregated reporting. When iterating on a single file, run it directly — it's faster and gives cleaner stack traces. Use the runner for `npm test` (full-suite invocation) and CI.

## Steps

1. **Install** tape-six as a dev dependency: `npm install -D tape-six`.

2. **Add the test script** to `package.json#scripts`:

   ```jsonc
   {
     "scripts": {
       "test": "tape6 --flags FO"
     }
   }
   ```

   Optional siblings:
   - `"test:seq": "tape6-seq --flags FO"` — sequential, in-process; easier to debug.
   - `"test:bun": "tape6-bun --flags FO"` / `"test:deno": "tape6-deno --flags FO"` — explicit-runtime sweeps for cross-runtime libraries.
   - `"start": "tape6-server --trace"` — browser-test HTTP harness.

3. **Add the `tape6` config block** to `package.json` for test discovery:

   ```jsonc
   {
     "tape6": {
       "tests": ["/tests/test-*.js"],
       "importmap": {
         "imports": {
           "my-package": "/index.js",
           "my-package/": "/src/"
         }
       }
     }
   }
   ```

   Per-environment globs (`cli`, `node`, `bun`, `deno`, `browser`) are additive on top of `tests`. Use them when a test imports environment-specific APIs (e.g. `node:http` tests under `cli` so they don't run in the browser worker).

4. **Verify**: `npm test`. To run a single file directly without the runner: `node tests/test-foo.js` (tape-six tests are directly executable; this is the fastest path when iterating on one file).

## Default flags

`--flags FO` — **F**ailures only, fail **O**nce (quiet on green, stop on the first red). It is a recommended default, not a mandate; some teams prefer the verbose default (no flags) or just `F` without early-exit. Lowercase disables, so `--flags fo` inverts both for one run (shows passes, continues past failures). Override per-invocation with the `TAPE6_FLAGS` environment variable: `TAPE6_FLAGS=FO node tests/test-foo.js`. Other flag letters cover banner / time / data / numbers / color — see [Supported flags](https://github.com/uhop/tape-six/wiki/Supported-flags) for the full list and override precedence.

## Runner family

Pick by environment, not preference. Default `tape6` auto-detects the runtime and routes appropriately; explicit pinning is for cross-runtime CI sweeps.

- **`tape6`** — default. Auto-detects Node / Bun / Deno.
- **`tape6-bun` / `tape6-deno` / `tape6-node`** — pin to a specific runtime (typically for cross-runtime CI matrices).
- **`tape6-seq`** — sequential, in-process. Use for debugging or when tests share state.
- **`tape6-server`** — browser-test HTTP harness. Run `npx tape6-server --trace`, then open `http://localhost:3000`.
- **`tape-six-proc`** (separate npm package) — process-per-file isolation when worker threads aren't enough.

## Further reading (wiki)

For anything beyond this skill, consult the wiki — it has the long tail:

- [Set-up tests](https://github.com/uhop/tape-six/wiki/Set-up-tests) — full `tape6` config-block reference, every per-environment glob.
- [Supported flags](https://github.com/uhop/tape-six/wiki/Supported-flags) — every flag, every override layer.
- [Utility tape6](https://github.com/uhop/tape-six/wiki/Utility-‐-tape6) — runner CLI options, env vars (`TAPE6_FLAGS`, `TAPE6_PAR`, `TAPE6_WORKER_START_TIMEOUT`), parallelism control, `--info`.
- [Utility tape6-server](https://github.com/uhop/tape-six/wiki/Utility-‐-tape6‐server) — browser harness, query parameters, dev-time path mounts.
- [Environment — Node](https://github.com/uhop/tape-six/wiki/Environment-‐-Node) / [Bun](https://github.com/uhop/tape-six/wiki/Environment-‐-Bun) / [Deno](https://github.com/uhop/tape-six/wiki/Environment-‐-Deno) / [Browsers](https://github.com/uhop/tape-six/wiki/Environment-‐-Browsers) — runtime-specific guidance.
