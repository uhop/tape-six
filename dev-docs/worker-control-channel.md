# Worker control channel — design note

Status: **the tape-six hub and all current worker providers are implemented**
(2026-05-30) — `tape-six-proc` (subprocess) plus `tape-six-puppeteer` /
`tape-six-playwright` (driver-backed browser). The driver-backed providers wire
the Node-side force-kill backstop; their cooperative-drain half goes live
end-to-end once they depend on the published hub release (tape-six is committed
but not yet published). Still to come: a DOM-free Web-Worker browser worker for
in-page force-kill on the standalone (driverless) browser run.

The channel spans **tape-six** (the worker abstraction + child-side listener;
the in-tree `par` worker-thread, `seq`
in-process, and standalone-browser iframe transports) and **all `tape-six-*`
worker providers** that supply a transport — `tape-six-proc` (subprocess),
`tape-six-puppeteer` / `tape-six-playwright` (driver-backed browser), and any
future ones. Each provider implements the control channel for its own transport.

## Implementation status (tape-six hub)

Done, verified on Node / Bun / Deno (`par`, `seq`, and `proc`):

- `EventServer` (`src/utils/EventServer.js`) owns the contract:
  `destroyTask(id, reason)` with `reason` ∈ `done | failOnce | timeout`;
  live-task tracking; the stop/bail abort-all trigger (keyed off the **raw**
  incoming `event.stopTest` / `bail-out`, so a failure in a worker still
  buffered behind the pass-through worker aborts the rest immediately, not when
  its buffer eventually flushes); and the optional per-worker deadline (Layer 2).
- Child-side `terminate` is a reporter primitive: `Reporter.terminate()`
  (`src/reporters/Reporter.js`) arms `stopTest` + fires the abort signal across
  the live state chain, and is **remembered** so a test that starts _after_ the
  terminate also stops at its first assertion (closes the startup race). The
  per-runtime `worker.js` listeners and the seq / browser transports all route
  through it.
- Proc child-side listener: `src/utils/control-channel.js`, opened by `index.js`
  when a child is marked `TAPE6_CONTROL` (set by `tape-six-proc`). It reads the
  line-delimited control channel off stdin (cross-runtime: `Readable.toWeb`
  on Node, `Bun.stdin.stream()`, `Deno.stdin.readable`), routes `terminate`
  through `Reporter.terminate()`, and the pending read keeps the child alive
  after its top-level `end` so the parent drives exit (closing the Bun
  stdout-flush race). Control-channel EOF soft-terminates; an unref'd watchdog
  is the dead-parent backstop.
- Config: `getGraceTimeout()` (env `TAPE6_GRACE_TIMEOUT`, default 5000) and
  `getWorkerTimeout()` (env `TAPE6_WORKER_TIMEOUT`, default 0 = disabled) in
  `src/utils/config.js`; injected into the worker via `getOptions()`.
- Tests: `tests/test-control-channel.js` (base contract via a mock transport);
  manual integration fixtures in `tests/manual/cc/`.

Caveat unchanged from the design: the cooperative drain is best-effort — a test
hung in a non-signal-aware `await` with no further asserts only stops when the
parent force-kills it after `graceTimeout` (`par` → `worker.terminate()`).

## Motivation

Today there is only a **data plane**: worker → reporter. Events flow up
(JSONL for `proc`, `postMessage` for `par`), the reporter renders them. There
is no **control plane** (reporter/runner → worker). Two things need it:

1. **`failOnce` / bail-out should actually stop in-flight workers.** When
   `reporter.state.stopTest` is set, `EventServer.createTask` / `close` only
   stop _scheduling new files_ (`fileQueue` is cleared). Already-running
   children run to completion; `proc` never kills them (`destroyTask` is the
   no-op stub with the commented-out `kill`). So `--flags FO` (failOnce) is a
   half-feature for `proc`: it won't cut short a slow or hung test.
2. **It closes the Bun flush race for free.** A `proc` child that self-exits
   after emitting its top-level `end` races Bun's teardown of the parent-side
   Web-Stream view of the child pipe, dropping the tail (the `end` token →
   the reporter never returns to top level → the summary banner is skipped;
   see `topics/tape-six-proc-bun-summary-suppressed`). If the child exits only
   when the **parent** tells it to — after the parent has read `end` — the
   race window is gone.

## Model

Two planes. **Data plane unchanged.** New **control plane**: a single command,
`terminate(reason?)`, sent reporter/runner → worker. The rule that makes the
Bun bug disappear: **a controlled child no longer self-exits after `end`; it
exits only on a terminate command or control-channel EOF.**

## Interface (EventServer, tape-six)

`EventServer` already declares the per-transport hooks. The control channel
gives `destroyTask` real meaning and adds the triggers; `report()` / `close()`
event-ordering logic is untouched.

```
destroyTask(id, reason?)   // per-transport: deliver `terminate` to one worker
                           //   par     → in-process method / worker.terminate()
                           //   proc    → write a command to child stdin (or end stdin)
                           //   browser → postMessage
```

Two triggers in the base:

- **Normal completion.** When the parent has consumed a task's top-level `end`,
  it terminates that worker (graceful "you're done"). This is the Bun fix:
  `end` is read _before_ exit is requested.
- **Stop / bail-out.** When `reporter.state.stopTest` is set (failOnce), the
  base terminates **all in-flight tasks** (abort) — in addition to the existing
  "stop scheduling new files."

Only the **exit trigger moves from child-driven to parent-driven.** No change
to the data plane.

## Child-side listener (tape-six runtime, controlled-child mode)

When a test file runs as a controlled child (the `proc` runner already marks
children via env — `TAPE6_JSONL` + prefix; reuse/extend that), the runtime:

- Opens the control channel (`proc`: read stdin; `par`: message handler).
- **After emitting the top-level `end`, stays alive** (holds the event loop
  open) until a terminate command or control-channel EOF arrives.
- On `terminate`: stop the current test if one is running (reuse the existing
  abort path — `isStopTest` / `t.signal`), run cleanup hooks best-effort,
  flush, exit `0`.
- On control-channel EOF: same as `terminate` (soft).

## Proc stdin protocol (tape-six-proc)

- Spawn with `stdin: 'pipe'` (today `'ignore'`).
- Commands are line-delimited, mirroring the JSONL data plane. Minimum: one
  line — `terminate` (or `{"cmd":"terminate","reason":"done|failOnce"}`).
- **Normal done:** parent reads the child's top-level `end` off stdout →
  writes `terminate` → `stdin.end()`.
- **Bail-out:** parent writes `terminate` to every live child, then `stdin.end()`.
- stdout / stderr consumption is unchanged. Completion is keyed off reading
  `end` (+ control EOF), not off racing the child's own exit.

## Two edges that must be right

1. **Zombie guard.** The child exits on control-channel **EOF**,
   unconditionally — if the parent dies or the pipe breaks, the child must not
   idle forever waiting for a command. EOF = soft terminate. A child-side
   watchdog timeout is reasonable belt-and-braces.
2. **Drain first, kill as backstop.** `terminate` should _drain_ a running
   test, not hard-kill it: fire the abort signal (`reporter.abort()` →
   `t.signal`) and arm `stopTest`, so the test unwinds gracefully — `StopTest`
   throws at the next assertion (`State.postprocess` already does this on
   failOnce / bailOut), any signal-aware `await` rejects, and the test's
   `finally` / `afterEach` / `afterAll` run (user cleanup). This reuses the
   existing **timeout** path, which already does `reporter.abort()` + the
   `StopTest` throw (`test.js:157–171`). Same in-process action for `par` and
   `proc`; only the delivery of "terminate" differs.

   **Caveat — drain is cooperative.** `StopTest` only lands at the _next
   assertion_, and `t.signal` only interrupts `await`s that were handed the
   signal; a test hung in a non-signal-aware `await` with no further asserts
   cannot be drained (JS can't inject an exception into a suspended `await`).
   So the full rule is **drain → bounded grace period → escalate to kill if the
   transport can**. The grace period is a configurable option — `graceTimeout`
   (ms), env `TAPE6_GRACE_TIMEOUT`, default **5000** (symmetric with the
   existing `TAPE6_WORKER_START_TIMEOUT`; generous enough for `afterAll` /
   `afterEach` cleanup that may tear down Docker, servers, or temp dirs). After
   issuing `terminate`, the parent/runner waits `graceTimeout` for the worker to
   exit; on expiry it force-kills **where the transport allows** — `proc`:
   `worker.kill()` (SIGTERM→SIGKILL); `par`: `worker.terminate()`; browser
   iframe: no reliable kill (see Termination transports). Cleanup runs in the
   drain phase; the kill only claims the hung tail. The grace deadline and kill
   are **parent/runner-side, per transport**; the drain itself is in-process in
   the child.

   Note: failOnce today throws `StopTest` but does _not_ call
   `reporter.abort()` (only timeout does) — the channel should fire **both**,
   or failOnce won't interrupt a signal-aware `await` that hasn't reached an
   assertion yet.

## Time-based termination (two layers)

Time-based termination decomposes into two layers that share the same
`terminate` machinery:

- **Layer 1 — per-test `timeout` (exists; in-process).** `test('…', {timeout},
fn)` (`test.js:157`): on expiry it reports `TIMED OUT`, calls
  `reporter.abort()` (fires `t.signal`), then `await result`. Because it's
  shared `test.js` running wherever the test executes, it's **uniform across
  all workers** — verified firing identically under par / seq / bun / deno /
  proc:node / proc:bun (browser runs the same code; comments arrive via the
  proxy reporter). **It is cooperative by design:** the `await result` means it
  reports + signals but then waits for the test's own promise to settle, so it
  cannot force-stop a test that ignores `t.signal` and never resolves.
- **Layer 2 — worker/file-level deadline (new; via this channel).** The
  runner/parent arms a wall-clock budget per task; on expiry it issues
  `terminate` — i.e. drain → grace → kill (edge #2). This is the enforcement
  Layer 1 lacks: it actually stops a hung worker. It is the _same_ code path as
  failOnce; only the trigger differs (a timer vs a failed assertion).

So Layer 1 stays the ergonomic per-test annotation; Layer 2 is the backstop
that makes any deadline real even when the test won't cooperate. The per-test
`timeout` and the worker deadline are not redundant — one reports inside the
test, the other guarantees the worker dies.

## Termination transports

`terminate` delivery (the drain request) and the force-kill backstop differ per
worker:

| worker                                                          | drain delivery                    | force-kill after `graceTimeout`                               |
| --------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------- |
| `par` (worker_threads)                                          | `postMessage` / in-process method | `worker.terminate()` ✓                                        |
| `proc` (subprocess)                                             | stdin command / close stdin       | process kill, SIGTERM→SIGKILL ✓                               |
| browser — iframe, driver-backed (puppeteer / playwright)        | `postMessage`                     | driver closes page / context from Node ✓ — _wired 2026-05-30_ |
| browser — iframe, standalone (`tape6-server` + a human browser) | `postMessage`                     | **✗ none** until a Web-Worker worker exists                   |
| browser — Web Worker (future)                                   | `postMessage`                     | `worker.terminate()` ✓ — **DOM-free tests only**              |

**Browser: in-page JS can't force-kill an iframe — but the driver can.** A
script already running in an `iframe`'s realm cannot be force-stopped by other
in-page JS; the parent page can `postMessage` a `terminate` (cooperative drain
works) and remove the iframe from the DOM, but a hung, non-cooperative test
keeps running until the page is torn down. **Where the browser is driven by
puppeteer / playwright, though, there's a Node-side kill lever:** the driver can
close the page / context / browser — a real force-kill, just one that lives in
the driver, not in-page. So a driver-backed browser worker honors
`graceTimeout` → kill (close the page), **wired in `tape-six-puppeteer` and
`tape-six-playwright` (2026-05-30)**. The case
with _no_ backstop is the **standalone** browser run (`tape6-server` + a human
browser, no driver). The often-cited in-page fix is an **alternative browser
worker built on a Web Worker** (terminable via `worker.terminate()`) — **but a
Web Worker has no DOM** (`document`, etc.), so it is _not_ a full browser
environment: it can run only **DOM-free** tests. That makes it a _partial_
backstop, not a drop-in for the iframe — a browser run would have to **route DOM
tests to the page / iframe** (still best-effort on kill) and **DOM-free tests to
a Web Worker** (terminable). The driver-kill backstop is now wired for the
driver-backed run; for the **standalone** (driverless) run, until such a
Web-Worker worker exists the iframe worker is best-effort on the kill backstop —
documented, not hidden.

**That routing needs a new test environment.** Today the environments are
`tests`, `browser`, `node`, `bun`, `deno`, `cli`. A Web-Worker browser worker
fits none: it is **not** `browser` (no DOM) and **not** `cli` (a browser Web
Worker lacks file access, processes, and other platform features). It would need
its own environment — DOM-free, browser-Web-Worker-runnable — so the runner can
route DOM tests to a real browser and the rest to Web Workers. Future design;
out of scope for the control channel itself.

Verified (per-test `timeout`, Layer 1): fires identically in real browsers
under **both** puppeteer and playwright (headless Chromium / Chrome) — the
`TIMED OUT` comment reaches the reporter through the iframe → proxy-reporter
path like every other event. (Playwright on a too-new host OS needs
`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` for the browser install.)

## Scope / ownership

The proposal spans **tape-six** plus **all `tape-six-*` worker providers** —
each implements the control channel for its own transport.

- **tape-six (the hub):** the `destroyTask` contract + the two triggers; the
  child-side control listener + keep-alive-after-`end`; reuse the existing
  `stopTest` / abort plumbing; the `graceTimeout` option + default (shared
  config, alongside `TAPE6_WORKER_START_TIMEOUT`). Hosts the in-tree workers:
  `par` (worker_threads) and `seq` (in-process) — both already race-free, the
  channel just unifies their API — and the standalone-browser iframe worker
  (`tape6-server` + the web-app), which gets cooperative drain via `postMessage`
  but no in-page force-kill.
- **`tape-six-proc`:** `stdin: 'pipe'` + write `terminate` + end-on-done; treat
  control EOF / `end` as completion instead of racing child exit; honor
  `graceTimeout` before `worker.kill()`.
- **`tape-six-puppeteer` / `tape-six-playwright`:** driver-backed browser
  workers — `postMessage` for drain; the Node-side driver closes the page /
  context / browser as the force-kill backstop (**wired 2026-05-30**).
- **Every `tape-six-*` worker provider** implements the same `terminate`
  contract for its own transport; new providers inherit the requirement. A
  future Web-Worker-based browser worker (terminable via `worker.terminate()`)
  would back-stop only **DOM-free** tests — a Web Worker has no DOM, so it's a
  partial answer that needs its own test environment (see Termination
  transports); DOM tests stay on the best-effort path.

## Non-goals

- One command (`terminate`), not a general RPC.
- No data-plane change (events stay one-way up).
- No new dependency.

## Relationship to the Bun bug

Resolved as a side effect of parent-driven exit: the parent reads `end` before
issuing `terminate`, so the child exits only after the parent holds the full
output — Bun's exit-time Web-Stream truncation window is closed.

This proposal is not about a bug. It is a proper implementation of a feature
that was conceived but not fully implemented: the closed loop with a reporter
and a time-based termination.
