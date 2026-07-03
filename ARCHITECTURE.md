# Architecture

`tape-six` is a TAP-based unit testing library for modern JavaScript (ES6+). It has **zero runtime dependencies** — only dev dependencies for type-checking, formatting, and browser automation. The vendored `deep6` library is copied into the source tree at build time.

## Project layout

```
index.js              # Main entry point: auto-detects runtime, sets up reporter, exports test/hooks
index.d.ts            # TypeScript declarations for the full public API
package.json          # Package config; "tape6" section configures test discovery
bin/                  # CLI utilities (all directly executable)
├── tape6.js          # Dispatcher: detects runtime → imports tape6-node/bun/deno
├── tape6-node.js     # Node.js parallel test runner (worker threads)
├── tape6-bun.js      # Bun parallel test runner
├── tape6-deno.js     # Deno parallel test runner
├── tape6-seq.js      # Sequential in-process runner (no threads)
├── tape6-server.js   # Pluggable test server CLI (thin shell over src/test-server.js)
└── tape6-runner.js   # Helper: returns paths to tape6-* executables
src/                  # Source code
├── test.js           # Core: test registration, execution, hooks, argument processing
├── Tester.js         # Tester class: all assert methods, embedded tests, utilities
├── OK.js             # Expression evaluator helper for eval(t.OK(...))
├── State.js          # Reporter state management (counters, hooks, nesting)
├── server.js         # HTTP server test fixtures: withServer/startServer/setupServer (internal; for tape-six-* siblings)
├── server.d.ts       # Type declarations for server.js
├── response.js       # HTTP response helpers: asText/asJson/asBytes/header/headers (internal)
├── response.d.ts     # Type declarations for response.js
├── test-server.js    # Embeddable test server: createTestServer/withTestServer (public)
├── test-server.d.ts  # Type declarations for test-server.js (incl. the plugin contract)
├── test-server/      # Test server internals
│   ├── adapter.js    # node req/res ⇄ WHATWG Request/Response bridge + iterable sugar
│   ├── registry.js   # PluginRegistry: normalization, longest-prefix routing, lifecycle
│   ├── control.js    # Control endpoints: /--tests, /--patterns, /--importmap, /--plugins
│   ├── statics.js    # Static file serving (GET/HEAD only)
│   ├── certs.js      # TLS cert ladder for the h2 mode (env/config → openssl self-signed)
│   ├── trace.js      # Request trace logging + shared paint helpers
│   └── plugins/
│       └── echo.js   # The /--echo reference plugin
├── reporters/        # Output format implementations
│   ├── Reporter.js   # Base reporter class
│   ├── TapReporter.js    # TAP protocol output (default fallback)
│   ├── TTYReporter.js    # Colored terminal output (default for Node/Bun/Deno)
│   ├── JSONLReporter.js  # JSON Lines output (for machine consumption)
│   ├── ProxyReporter.js  # Forwards events to a parent window (browser iframes)
│   └── MinReporter.js    # Minimal reporter
├── runners/          # Runtime-specific test worker implementations
│   ├── node/         # Node.js: TestWorker.js + worker.js (worker_threads)
│   ├── bun/          # Bun: TestWorker.js + worker.js
│   ├── deno/         # Deno: TestWorker.js + worker.js
│   └── seq/          # Sequential: TestWorker.js + BypassReporter.js
├── utils/            # Shared utilities
│   ├── config.js     # CLI arg parsing, options, test discovery, reporter init
│   ├── listing.js    # Glob-based test file listing
│   ├── capture-console.js  # Console capture for test output isolation
│   ├── timer.js      # Cross-runtime high-resolution timer
│   ├── defer.js      # Cross-runtime microtask/macrotask defer
│   ├── formatters.js # Value formatting for reporter output
│   ├── yamlFormatter.js   # YAML formatting for TAP diagnostics
│   ├── box.js        # Box drawing for TTY reporter
│   ├── sanitize.js   # String sanitization utilities
│   └── EventServer.js     # Event-based communication for workers
└── deep6/            # Vendored deep equality library (copied at build time, gitignored)
web-app/              # Browser test UI application
├── index.html        # Main HTML page
├── index.js          # Web app entry point
├── DomReporter.js    # DOM-based test result reporter
├── DashReporter.js   # Dashboard reporter with donut chart
└── TestWorker.js     # Browser worker (uses iframe isolation)
tests/                # Test files (test-*.js, test-*.mjs, test-*.cjs, test-*.ts)
wiki/                 # GitHub wiki documentation (git submodule)
vendors/              # Git submodules
└── deep6/            # deep6 source (copied to src/deep6/ at build time)
scripts/              # Build helper scripts
└── copyFolder.js     # Copies vendored deep6 into src/
skills/               # Agent Skills (agentskills.io) shipped to consumers via npm
└── write-tests/      # Skill for writing tape-six tests
```

## Core concepts

### Test lifecycle

1. User imports `test` from `tape-six` → `index.js` runs.
2. `index.js` auto-detects the runtime (Node/Deno/Bun/browser).
3. It selects and configures the appropriate reporter (TTY, TAP, JSONL, Proxy, or DOM).
4. `test()` calls register test functions into a queue.
5. The test runner (`testRunner` in `index.js`) executes queued tests sequentially, running hooks at the appropriate points.
6. Each test receives a `Tester` object with assert methods.
7. Results are reported via the configured reporter.

### Two main objects

- **`test()`** — registers test suites. Aliased as `suite()`, `describe()`, `it()`. Supports `test.skip()`, `test.todo()`, `test.asPromise()`.
- **`Tester`** — passed to test functions. Provides all assert methods (`ok`, `equal`, `deepEqual`, `throws`, `rejects`, etc.), embedded test methods (`t.test()`, `t.skip()`, `t.todo()`), hooks (`t.beforeAll()`, `t.afterAll()`, `t.beforeEach()`, `t.afterEach()`), and utilities (`t.plan()`, `t.comment()`, `t.any`). Extensible via `registerTesterMethod(name, fn)` from plugins; `Tester` is declared as an `interface` in `index.d.ts` so TS module-augmentation works naturally. Ambient integrations use `getTester()` (current `Tester` or `null`) and `Tester.reportAssertion({ok, message, marker, …})` to report into the running test; `index.js` installs an invariant host at `globalThis[Symbol.for('tape6.invariant.host.v1')]` (see `dev-docs/sister-assert-library.md`).

### Hooks

Hooks are scoped to their registration level:

- **Top-level**: `beforeAll()`, `afterAll()`, `beforeEach()`, `afterEach()` from `tape-six` affect top-level tests.
- **Nested**: `t.beforeAll()`, etc., on a `Tester` object affect that test's embedded tests.
- **Options**: hooks can also be passed in `TestOptions`.

### Reporters

| Reporter        | When used                                 | Format                  |
| --------------- | ----------------------------------------- | ----------------------- |
| `TTYReporter`   | Default for Node/Bun/Deno terminals       | Colored, human-readable |
| `TapReporter`   | When `TAPE6_TAP` is set, or as fallback   | TAP protocol            |
| `JSONLReporter` | When `TAPE6_JSONL` is set                 | JSON Lines              |
| `MinReporter`   | When `TAPE6_MIN` is set                   | Minimal output          |
| `ProxyReporter` | Browser iframes communicating with parent | Event forwarding        |
| `DomReporter`   | Browser web app                           | DOM rendering           |

All reporters implement `report(event, suppressStopTest = false)`. The method:

1. Calls `this.state?.preprocess(event)` to update counters and enrich the event.
2. Handles the event (output, DOM updates, forwarding, etc.).
3. Calls `this.state?.postprocess(event, suppressStopTest)` to throw `StopTest` when `failOnce` is active and an assertion fails — unless `suppressStopTest` is `true`.

### CLI architecture

`tape6` (the main command) is a thin dispatcher:

```
tape6 → detects runtime → imports tape6-node / tape6-bun / tape6-deno
```

Each runtime-specific runner:

1. Reads configuration from `tape6.json` or `package.json`.
2. Resolves test file patterns using glob matching.
3. Spawns worker threads to run test files in parallel.
4. Aggregates results and reports via the configured reporter.

`tape6-seq` runs tests sequentially in the same process (no workers).

`tape6-server` serves files for browser-based testing and provides a web UI.

### Test server

`bin/tape6-server.js` is a thin CLI shell over `src/test-server.js`, which exports
`createTestServer()` (embeddable; `port: 0` gives parallel test files collision-free servers)
and `withTestServer()` (scoped wrapper). Request routing: reserved control endpoints
(`/--tests`, `/--patterns`, `/--importmap`, `/--plugins`) → fixture plugins by longest URL
prefix → static files (GET/HEAD only; plugins see all verbs).

Plugins speak WHATWG `Request`/`Response` behind a small adapter (streamed bodies,
`duplex: 'half'` request streams, client disconnect wired to `request.signal`); `fetch` may
return an (async) iterable for streamed output (objects become JSONL), and `raw(req, res)` is
the escape hatch on raw Node objects. Registration is static (`tape6.server.plugins` config +
`--plugin`) and dynamic (`PUT`/`DELETE /--plugins`, contained to rootFolder-relative modules;
`--no-remote-plugins` disables). `--h2` switches to `http2.createSecureServer({allowHTTP1:
true})` with a cert ladder (`TAPE6_CERT`/`TAPE6_KEY` → cached openssl self-signed) — Node-only
server mode, needed for browser `fetch()` upload streaming (Chromium, h2/h3-only). Full
design: `dev-docs/pluggable-test-server.md`.

### Worker control channel

`EventServer` is the base of every runner's `TestWorker`. Beyond the data plane
(worker → reporter events) it owns a one-command control plane (runner → worker
`terminate`), exposed as `destroyTask(id, reason)` where `reason` is `done`
(the task finished), `failOnce` (a worker hit failOnce / bail — stop the rest),
or `timeout` (the optional per-worker deadline, env `TAPE6_WORKER_TIMEOUT`, ran
out). The worker drains cooperatively — `Reporter.terminate()` arms `stopTest`
and fires the abort signal so the running test unwinds and its cleanup hooks run
— and is force-killed where the transport allows after `TAPE6_GRACE_TIMEOUT` ms.
Each `tape-six-*` provider implements the same contract for its own transport.
See `dev-docs/worker-control-channel.md`.

### Deep equality

The `deep6` library (vendored via git submodule) provides:

- `equal(a, b)` — recursive strict deep equality.
- `match(a, b)` — structural pattern matching with wildcard support (`t.any`).

It is copied from `vendors/deep6/src/` to `src/deep6/` at build time (`npm run build`).

## Module dependency graph (simplified)

```
index.js ← src/test.js ← src/Tester.js
               ↑               ↑
          src/State.js    src/OK.js
               ↑               ↑
        src/reporters/*   src/deep6/*

bin/tape6.js → bin/tape6-node.js → src/runners/node/TestWorker.js
             → bin/tape6-bun.js  → src/runners/bun/TestWorker.js
             → bin/tape6-deno.js → src/runners/deno/TestWorker.js

bin/tape6-seq.js → src/runners/seq/TestWorker.js

bin/tape6-server.js → src/test-server.js → src/test-server/* (adapter, registry, control, statics, certs, trace)
                                         → src/server.js (startServer)

src/utils/config.js ← (used by all bin/* runners for test discovery)
src/utils/listing.js ← (glob-based file listing)
```

## Testing

- **Framework**: tape-six tests itself
- **Run all**: `npm test` (parallel workers)
- **Run single file**: `node tests/test-<name>.js`
- **Run with Bun**: `npm run test:bun`
- **Run with Deno**: `npm run test:deno`
- **Run sequentially**: `npm run test:seq`
- **Run sequentially (Bun)**: `npm run test:seq:bun`
- **Run sequentially (Deno)**: `npm run test:seq:deno`
- **TypeScript check**: `npm run ts-check`
- **Lint**: `npm run lint` (Prettier check)

## Import paths

```js
// Main API (for test authors)
import test from 'tape-six';
import {test, beforeAll, afterAll, beforeEach, afterEach} from 'tape-six';
import {describe, it} from 'tape-six';

// CommonJS
const {test} = require('tape-six');
```
