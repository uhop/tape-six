# Browser-driver kit — design note

Status: **design accepted, not implemented** (2026-07-10). Implementation is a
tape-six minor plus paired `tape-six-puppeteer` / `tape-six-playwright`
releases. This note records the measured duplication, the decided split, and
the rollout plan.

## Problem — measured duplication

The two driver-backed browser providers are near-clones (measured 2026-07-10,
puppeteer 1.2.1 vs playwright 1.2.1):

- **Bins** (`tape6-puppeteer-node.js` 350 lines vs `tape6-playwright-node.js`
  352): **20 divergent lines**, all of them command names, version strings, and
  help text. Every line of logic — option/env parsing, server-URL and protocol
  resolution, the `controlFetch` readiness probe, `ensureServer` (spawn
  `tape6-server`, 15 s start deadline, protocol-mismatch diagnostics, 4 s
  drain), the per-engine run loop, summary and exit code — is identical.
- **TestWorkers** (296 vs 285 lines): **67 divergent lines**, and most of that
  is stylistic, not required — Puppeteer accepts the single-object
  `page.evaluate(fn, arg)` convention Playwright mandates, and the 1.14.1
  typings made the puppeteer-side casts droppable. The irreducible differences
  fit four template members (§ Adapter surface).
- **`web-app/TestWorker.js` is a third copy** of the in-page bootstrap: the
  same `__tape6_reporter` / `__tape6_error` wiring, `test-iframe-<id>` naming,
  and `__tape6_id` / `__tape6_testFileName` / `__tape6_flags` HTML injection,
  in a driverless `document.write` variant.

Consequences: every fix lands two or three times (the readiness-probe
time-bounding shipped separately in both 1.2.1s), and the in-page contract that
core itself defines — `index.js` calls `__tape6_reportResults`, the
`ProxyReporter` posts to `__tape6_reporter`, the `tape6-terminate` message the
iframe transport listens for — is implemented outside core. Precedent:
`controlFetch` was hand-mirrored byte-for-byte by both drivers until 1.14.0
hoisted it into core as the contract owner.

## Adapter surface — what is genuinely driver-specific

From the diff, everything the drivers do differently fits four members:

1. **`supportedBrowsers`** — `['chromium', 'firefox']` (Puppeteer) vs
   `['chromium', 'firefox', 'webkit']` (Playwright).
2. **`launchBrowser(name)`** — engine/product mapping (`chromium` → `chrome`
   on Puppeteer), launch options (`--no-sandbox` for Chromium; Puppeteer takes
   `acceptInsecureCerts` at launch), and the driver's install-remediation
   message on launch failure.
3. **`newContext(browser, {insecure})`** — `createBrowserContext()`
   (Puppeteer) vs `newContext({ignoreHTTPSErrors})` (Playwright; this is where
   its insecure-cert flag lives).
4. **`pageErrorEvent`** — `'error'` (Puppeteer) vs `'pageerror'` (Playwright).

Everything else is API-identical across the two drivers: `context.newPage()`,
`page.exposeFunction`, `page.goto`, `page.evaluate` with a single object
argument, `page.on('close' | 'console')`, `context.close()`.

## Design — three core modules

All under `src/utils/`, CLI-side like `EventServer`; the bootstrap module is
browser-safe (pure string building, no `node:` imports).

### `utils/browser-bootstrap.js` (browser-safe)

Owns the in-page harness text: the srcdoc HTML for JS test files (importmap
injection, `__tape6_id` / `__tape6_testFileName` / `__tape6_flags` globals, the
module-script loader with `__tape6_error` wiring), the URL+query form for
`.html` test files, the `test-iframe-<id>` naming rule, and the
`tape6-terminate` postMessage shape used for cooperative drain. This is the
module that can later retire the `web-app/TestWorker.js` copy and serve the
future DOM-free Web-Worker worker (see `worker-control-channel.md` § still to
come).

### `utils/BrowserTestWorker.js`

`class BrowserTestWorker extends EventServer` — the entire shared task
lifecycle, verbatim from today's sisters:

- `makeTask`: supported-extension gate; the launch-failure guard that reports a
  real failure instead of a false exit-0 pass.
- Per-task `BrowserContext` + `Page`; completion driven solely by the page
  `'close'` event (normal end, cooperative drain, and force-kill all funnel
  through it, so `close(id)` fires exactly once per task).
- `__tape6_reporter` / `__tape6_error` exposure with the
  `end`/`terminated` → `destroyTask('done')` watch and `StopTest` swallowing.
- `/--tests` navigation (origin inheritance), page reset, console forwarding,
  iframe injection via `browser-bootstrap`, and the `stopRequested` catch-up
  for tasks that start mid-abort.
- Control plane: cooperative drain via `tape6-terminate`, `graceTimeout`
  force-kill by closing the context, idempotent kill/cleanup.

Subclasses supply the four adapter members from § Adapter surface. The base
standardizes on the single-object `evaluate` convention (both drivers accept
it), which erases the largest stylistic diff class outright.

### `utils/browser-driver-cli.js`

`runBrowserDriverCli({commandName, description, supportedBrowsers, TestWorker})`
— everything the bins share: option/env parsing (`--server-url`/`-u`,
`--browser`, `--flags`, `--parallel`, `--start-server`, help/version/self;
`TAPE6_SERVER_URL`, `TAPE6_BROWSER`), config + protocol resolution (typed via
`Tape6ServerConfig` since 1.14.1+), the `controlFetch` readiness probe,
`ensureServer` with its deadlines and protocol-mismatch diagnostics, the
per-engine run loop, and summary/exit-code handling. A sister bin collapses to
a shebang, two imports, and one call.

## What stays in the sisters

The driver dependency and the adapter subclass (four members plus the
install-remediation text), their bins' identity lines, and their e2e suites —
which remain the kit's only real-browser verification. Estimated per driver:
from ~650 duplicated lines to ~80–100 owned lines.

## Testing strategy

- **Core**: unit tests with a fake driver adapter (task lifecycle, grace
  timers, bootstrap text, CLI parsing) under `tests/cli/`. Core stays
  zero-dep: no browser driver in devDependencies, so the kit is never
  e2e-tested from core's own CI.
- **Sisters**: their existing suites are the integration gate; a paired
  release ships only after both drivers pass on the release-candidate core.

## Rollout

1. tape-six minor: the three modules, `.d.ts` sidecars (sister-imported
   surface is typed per the 1.13/1.14 convention), fake-driver unit tests.
2. Paired sister releases adopt the kit, delete the mirrored code, bump their
   tape-six floor — the `controlFetch` adoption (both 1.2.1s) is the
   procedural template.
3. Separate follow-ups: `web-app/TestWorker.js` adopts `browser-bootstrap`;
   the DOM-free Web-Worker worker builds on it.

## Risks and open questions

- **Adapter completeness.** The four-member contract is validated against
  today's full diff, not speculation. If a future driver (or a driver update,
  e.g. BiDi changes) needs more, widen the contract then.
- **Core ships driver-facing code it can't drive in CI.** Mitigated by the
  fake-driver unit tests plus the sisters-pass-first release gate; this is the
  same posture `EventServer` already has toward `tape-six-proc`.
- **Version coupling.** Kit changes ripple to both drivers — no worse than
  today's `EventServer` coupling, and strictly better than editing two clones.
- **Naming** (`BrowserTestWorker` vs `DriverTestWorker`, exact CLI-runner
  signature) — decide at implementation; nothing downstream depends on the
  names until the sisters adopt.
