# Testing landscape and directions

Status: **research + proposal, 2026-07-05.** A survey of where the JavaScript
testing field is heading (mid-2026) and a set of concrete directions for
`tape-six`. This is a foundation to argue from, not a committed plan — every
recommendation is tagged with a tier and a rationale so we can pick and
sequence deliberately.

Companion reading: the blog post _TDD as religion_
(`~/Open/blog-hugo/content/blog/2026-07-07-tdd-as-religion/`) frames the
philosophy this doc operationalizes — **tests sample, they don't prove**; the
newer techniques (property-based testing, fuzzing, mutation testing) are
_better sampling_, still sampling, Monte Carlo with a price tag. That framing
is the lens for every "should we adopt this?" call below: we price a technique
by what it actually buys, and we keep the core honest about the difference
between _ran_ and _checked_.

> A note on sources: the external claims here were gathered from primary
> sources (official docs, release notes, GitHub) via automated research passes
> on 2026-07-05/06, each run through 3-vote adversarial verification. **Verified
> (high confidence):** the fast-check, Jazzer.js, StrykerJS, node:test-snapshot,
> Vitest (bench / type-testing / in-source / visual-regression), DST, and
> TAP-14-subtest facts, **and** — after a focused second pass — the CI
> perf-regression statistics (Bencher's seven tests, Nyrkiö's E-Divisive
> changepoint, CodSpeed's modes, github-action-benchmark's naive ratio), the
> metamorphic/CGPT findings, and the local-first history prior art (Buildkite
> schema, Datadog quarantine/disable, Trunk monitors, Flakinator scoring). The
> "sourced but not double-checked" hedge no longer applies to any of these.
> **Residual (treat as provisional):** the Bun / Deno native snapshot & bench
> API specifics (file formats, update flags, serializers), flagged inline in
> §4.5. Two claims were **refuted** and corrected below: TAP 14 does _not_
> strictly mandate a `TAP version 14` first line, and node-tap does _not_ always
> emit one. The architectural facts about tape-six / nano-bench were verified
> directly against the repos.

## 1. What this doc decides

Eight questions, answered in §4:

1. Property-based testing (fast-check et al.) — adopt how?
2. Fuzzing — is there anything here for us?
3. Mutation testing — how do we plug in?
4. Statistical / search-based / simulation techniques — what's real for JS?
5. Snapshots — the queued item; what's the design?
6. Performance-regression-as-a-test — the nano-bench synergy question.
7. Test-run history / time series — should we, and where does it live?
8. Everything else emerging 2024–2026 worth a minimal framework's attention.

Two of the answers lean on infrastructure decisions the project owner set this
session and that recur across several features, so they get their own sections:
a **vendored statistics package** (§5) shared by tape-six and nano-bench the
way `deep6` is vendored, and a **tape6-server-based web UI** (§6) that folds
history/analytics into the already-queued "web application for test running."

## 2. Where tape-six stands today

The starting position — what we already have that these directions build on:

- **BYO over bundling, with shape recognition.** We don't ship an assertion
  library; we catch what test code throws and render `AssertionError`-shaped
  errors nicely (`isAssertionError` in `src/State.js`: duck-typed
  `name === 'AssertionError'` + string `message` + string `operator`). The
  wiki already documents verified BYO paths for `node:assert`, `chai`,
  `expect`, `fast-check`, `node:test` mock, and `sinon`
  (`wiki/3rd‐party-*.md`).
- **A plugin pattern (1.9.0).** `registerTesterMethod(name, fn)` lets a
  separate package add `t.<method>`; `t.OK` is the in-tree worked example.
  Plugins live in their own packages, imported per test file. The queue's
  "await a second consumer" caution is retired: the cost of a new method is now
  "publish a small package."
- **An ambient-integration protocol.** `getTester()` +
  `Tester.reportAssertion({ok, message?, marker?, operator?, expected?,
actual?})` + a global host slot `Symbol.for('tape6.invariant.host.v1')`.
  `tape-six-invariant` (shipped 2026-06-27) uses exactly this and never imports
  tape-six. This is the template for any "external thing materializes
  assertions into a live run" feature.
- **A pluggable test server** (`dev-docs/pluggable-test-server.md`). Fixture
  plugins mount under a URL prefix with a WHATWG `fetch(request) → Response |
iterable | undefined` contract; reserved control endpoints (`/--tests`,
  `/--patterns`, `/--importmap`, `/--plugins`); embeddable via
  `createTestServer({port: 0})`. This is the storage/endpoint substrate for
  browser-side snapshots and for run history.
- **A browser web-app** (`web-app/`). Today deliberately thin: fire-once on
  page load, reads `?flags` / `?par` / `?q` patterns from the URL, runs the
  resolved file list via `TestWorker`, renders to DOM + donut. Selection _is_
  possible (`?q=` routes through `/--patterns`, repeatable) and _is_ documented
  (`wiki/Environment-‐-Browsers.md` § Supported search parameters) — but only as
  a hand-formed URL, framed as "specify a test file," with no interactive
  affordance. No on-demand re-run, no persistence, no history.
- **A structured event stream.** The JSONL reporter emits one JSON object per
  event; events carry per-test timing. State serialization already tags
  `Symbol`/`Error`/`RegExp`/`Set`/`Map`/`Circular` structurally
  (`src/State.js` replacer) — a reusable serializer for snapshots.
- **TAP output that is _un-verified for conformance_.** We emit TAP and it was
  sanity-checked against existing TAP reporters early on, but it has **never
  been run through a TAP verifier/validator**. So "tape-six is TAP-compliant"
  is currently an assumption, not a tested fact — and interop with any external
  TAP consumer (StrykerJS's TAP runner, analytics ingesters, `tap`/`prove`
  harnesses) rests on that untested assumption. This is a gap, and §4.8 + §7
  treat closing it as foundational, because several recommendations here route
  through TAP interop.
- **A sibling that is all statistics: `nano-benchmark`.** Nonparametric
  micro-benchmarking (bootstrap CI on medians, Mann-Whitney U, Kruskal-Wallis +
  Conover-Iman post-hoc, Holm/Bonferroni correction, KS test, streaming
  mean/variance/skew/kurtosis, streaming median, seeded PRNG). Its results-file
  design — **raw samples are the source of truth; summaries recomputed on
  read** — plus environment capture and per-function `bodyHash` comparability
  is directly reusable for perf-regression testing and run-history analysis.

**The scope guardrails** (from `projects/tape-six/queue.md`, restated so the
recommendations respect them): no replacing platform foundations; pure-JS
composition welcome; BYO third-party over reinvention; a single cross-platform
core (browsers are the binding constraint); the console-proxy stdout demux is
the one deliberate exception. Every recommendation below is checked against
these.

## 3. The economics that drive the verdicts

From the TDD post, made concrete for roadmap decisions:

- **Better sampling is still sampling.** PBT, fuzzing, and mutation testing
  raise the _odds_ of hitting a bug; none proves absence. We adopt them as
  **priced tools**, exposed through the cheapest integration that works —
  almost always BYO/plugin, almost never a bundled engine we maintain.
- **The commodity/value split** (fleet rule: retire the commodity, keep the
  glue). The generators, fuzzing engines, mutation runners, and stats kernels
  are commodities other people maintain better than we would. Our value is the
  _glue_: the reporter that recognizes their output, the `t.*` method that
  makes them ergonomic, the storage/UI that makes their results durable and
  legible. Build the glue; adopt the commodity.
- **A green suite is not free, and neither is a feature.** Anything we add to
  core is re-run, maintained, and ported to four runtimes forever. That cost is
  why "recognize it" and "plugin for it" beat "build it into core" unless the
  capability genuinely needs to live in the core.

## 4. The field, area by area

Each area: **state** (what exists mid-2026), **relevance** (to tape-six),
**verdict** (tiered — see §7 for the tier definitions).

### 4.1 Property-based testing

**State.** `fast-check` is the ecosystem's center of gravity and actively
maintained (latest release reported v4.8.0, 2026-05-11; ~5.1k stars; MIT;
~94% TypeScript). It's used inside Jest, Jasmine, fp-ts, io-ts, ramda,
js-yaml. Its monorepo hosts first-party **adapter packages** —
`@fast-check/vitest`, `@fast-check/jest`, `@fast-check/ava`,
`@fast-check/worker`. The integration pattern is instructive: the adapter
_wraps the framework's test function_ and injects a generator `g` into the
callback; arbitraries (`g(fc.nat)`, etc.) are composed from the library, not
bundled into the runner. Determinism is the selling point — every failure
traces to an exact value + seed. Beyond plain PBT, fast-check ships
**`fc.scheduler`** (first-class race-condition testing by controlling promise
resolution order; replay via `fc.schedulerFor(ordering[])`) and **model-based
testing** of state machines. The race-conditions guide was updated 2026-04.

**Relevance.** This is the single strongest adoption opportunity in the survey.
fast-check throws a plain `Error` on counterexample (not `AssertionError`), so
today it renders as `UNEXPECTED EXCEPTION` with the seed/path in the message —
functional but second-class (documented in
`wiki/3rd‐party-property-based-testing.md`). The `@fast-check/vitest` adapter
pattern maps almost exactly onto `registerTesterMethod`: a `tape-six-fast-check`
plugin could provide `t.prop(arbitraries, predicate)` that runs the property,
counts a real assertion on success, and reports a _named_ failure with the
shrunk counterexample + seed through `Tester.reportAssertion` instead of a bare
throw.

**Verdict.**

- **Tier 1 (recognition):** teach the reporter to prettify fast-check's failure
  shape — its counterexample message is structured and stable enough to parse
  the seed/path/shrunk-input into `expected`/`actual`/diagnostic fields. Cheap,
  high-value, no new dependency.
- **Tier 2 (plugin):** a `tape-six-fast-check` sister providing `t.prop` (and
  `t.scheduler` for the race-condition path), following the invariant-package
  template — the plugin imports fast-check and reports through our protocol;
  core stays zero-dep. This is the flagship plugin to build first; it also
  validates the plugin pattern under a real, popular dependency.
- **Tier 0 (docs):** expand the wiki PBT page now to cover `fc.scheduler` and
  model-based testing with tape-six, independent of any code.

No credible general-purpose alternative displaces fast-check; don't build a
generator.

### 4.2 Fuzzing

**State.** `Jazzer.js` (Code Intelligence) is the coverage-guided,
in-process JS fuzzer built on libFuzzer. It went through a scare — discontinued
as OSS in Feb 2024, a restrictive interim license, a commercial "Jazzer Pro" —
but is **revived and maintained**: v4.0.0 (2026-04-15), repo pushed 2026-06-29,
with ESM support, arm64, new sanitizers, per-test dictionaries. The v3.x gap
was the commercial line, not abandonment. Adoption is modest (~351 stars). Its
framework integration is a **custom Jest runner** (`@jazzer.js/jest-runner`).
OSS-Fuzz's JavaScript support is "powered by Jazzer.js," but the toolchain
shows staleness (base images on EOL Node 19; no native sanitizers for pure JS —
fuzzing JS finds logic/uncaught-exception crashes, not memory bugs).

**Relevance.** Coverage-guided fuzzing needs bytecode/native instrumentation
and a libFuzzer harness — squarely a **platform-foundation** concern and
firmly outside our guardrails. It's also Node-only in practice, and browser
fuzzing isn't a thing we can offer. Fuzzing's _ergonomic_ surface (feed
structured random bytes to a target, shrink on crash) overlaps heavily with
what fast-check already gives us portably.

**Verdict.** **Rejected for core; watch-only.** Don't build or bundle a fuzzer.
If a user needs coverage-guided fuzzing, the answer is "use Jazzer.js directly
(Jest-runner) for that target." At most, a **Tier 0** wiki note explaining the
boundary and pointing at fast-check for portable randomized testing and
Jazzer.js for Node coverage-guided fuzzing. Revisit only if a platform-native,
cross-runtime coverage-fuzz primitive appears.

### 4.3 Mutation testing

**State.** `StrykerJS` is the JS mutation-testing standard. It has an
**incremental mode** (since Stryker 6.2): a git-like diff of code+tests against
a persisted `reports/stryker-incremental.json`, re-running mutants only for
changed code while still producing a full report. Crucially for us, Stryker's
incremental accuracy is tiered by **test-runner reporting fidelity**, and
**StrykerJS ships a TAP test-runner integration** — at the "tests per file
without location" tier, the _same tier as its Vitest and Mocha runners_.

**Relevance.** This is a near-free win hiding in plain sight. Mutation testing
is the technique that most directly measures the _ran-vs-checked_ gap the TDD
post is about — it plants bugs and checks that some assertion notices. And
because Stryker has a generic **TAP runner**, tape-six's existing TAP output
likely already makes it a usable Stryker target with no new code. The work is
_verification and documentation_, not implementation.

**Verdict.**

- **Tier 0 (verify + docs):** confirm tape-six runs under StrykerJS's TAP
  runner (a spike: point Stryker's `tap` runner at a tape-six suite, read the
  mutation report), then document the setup in a new wiki page. If a small
  output tweak improves the fidelity tier, that's a cheap **Tier 1**.
  _Prerequisite:_ this spike depends on our TAP output actually being
  conformant, which is itself unverified (see §4.8) — so the TAP-conformance
  audit gates this. If Stryker's TAP runner chokes on our stream, that's a
  conformance bug to fix, and finding it here is exactly the kind of interop
  evidence the audit is for.
- **Rejected for core:** don't build a mutation engine. Stryker owns this
  commodity.

### 4.4 Statistical, search-based, and simulation techniques

**State.**

- **Metamorphic testing** (assert relations between related inputs/outputs when
  no oracle exists — e.g. `sin(x) == sin(π−x)`) is a real, useful _discipline_
  but needs no framework machinery: it's a way of writing ordinary assertions,
  and composes naturally with PBT. Verified this session: the literature treats
  metamorphic testing as a **specialization of property-based testing** (arXiv
  2211.12003), so it layers directly on `t.prop` — the metamorphic relation _is_
  the property, expressed with fast-check's `fc.pre` precondition. Nothing to
  build.
- **Coverage-guided property-based testing (CGPT/FuzzChick)** (Lampropoulos,
  Hicks, Pierce, OOPSLA 2019) is the credible research-grade hybrid beyond
  fast-check + Jazzer.js: it instruments the target for branch coverage, keeps
  coverage-expanding inputs in a seed pool, and — unlike a byte-stream fuzzer —
  uses **type-aware datatype-level mutators**. Interesting as a future direction
  for a `t.prop` engine, not a near-term build.
- **Deterministic simulation testing (DST)** — run the system in a
  deterministic, controlled environment (clock, scheduling, randomness) for
  replayable exploration — is a systems-language practice (FoundationDB →
  Antithesis; MongoDB, TigerBeetle, Sui). Two shapes: (1) redesign the system so
  all nondeterminism is pluggable (FoundationDB style), or (2) run unmodified
  software inside a deterministic hypervisor (Antithesis) — the latter is
  language-agnostic and needs _no test-framework support_. There is no
  established JS-native DST framework; the JS analogue that exists is narrower
  (`fc.scheduler` for async interleavings).
- **Search-based / gradient-descent input search** remains largely academic in
  the JS ecosystem; coverage-guided fuzzers are the practical embodiment.
- **Statistical flaky-test detection** is real and productized — see §4.7.

**Relevance.** Metamorphic testing rides on §4.1's `t.prop` and on plain
assertions — nothing to build. DST is either out of scope (a hypervisor is not
a test framework) or already covered in miniature by fast-check's scheduler.
The one genuinely tape-six-shaped opportunity in this cluster is the
_statistics_ — but pointed at our own run history (§4.7) and perf regression
(§4.6), where we have a sibling (`nano-benchmark`) that is literally a
nonparametric-statistics engine.

**Verdict.**

- **Tier 0 (docs):** a wiki note on metamorphic testing with `t.prop`.
- **Rejected for core:** no DST engine, no search-based input generator. The
  async-interleaving slice is fast-check's `fc.scheduler`, surfaced via the
  §4.1 plugin.
- The statistics thread is **redirected** into §4.6 and §4.7, where it has a
  real home and a ready toolkit.

### 4.5 Snapshot testing (the queued item)

**State.** Snapshots have converged into a well-understood feature with a clear
design space, and every runtime now ships one:

- **node:test** _(verified):_ `context.assert.snapshot` / `fileSnapshot`,
  **stable since Node v23.4.0** (added v22.3.0). Default snapshot file is
  `<testfile>.snapshot`; regenerate with `--test-update-snapshots`;
  customization via `snapshot.setDefaultSnapshotSerializers(fn)` and
  `snapshot.setResolveSnapshotPath(fn)`.
- **Bun** _(provisional — sourced from Bun docs, not re-verified):_
  `toMatchSnapshot` (file-based, `__snapshots__/*.snap`, Jest-style) +
  `toMatchInlineSnapshot` (rewrites the test source) + `--update-snapshots` +
  `expect.addSnapshotSerializer` + property matchers.
- **Deno** _(provisional — sourced from Deno docs, not re-verified):_
  `t.assertSnapshot` built into the test context (no import), updated with
  `deno test -u`, stored as plain TypeScript in `__snapshots__/*.snap` via
  `Deno.inspect`; custom serializers; also supports Node's `t.assert.fileSnapshot`
  through its compat layer.
- **Vitest/Jest:** file + inline snapshots; **refuses to write new snapshots in
  CI**; `toMatchFileSnapshot` for arbitrary named/typed files; pluggable
  serializers via `expect.addSnapshotSerializer`.
- **Playwright aria snapshots:** YAML of the accessibility tree, _partial/
  containment_ matching (not strict equality), inline or `.aria.yml` files,
  **reviewable patch files** on update. A notably different (and nice) update UX.
- **Vitest 4** added `toMatchScreenshot` (visual regression) in stable Browser
  Mode — snapshots extended into pixels.

The cross-cutting patterns: **one serializer interface + pluggable serializers;
a file backend keyed to the test; an explicit update flag; a CI safety rule
(don't create snapshots in CI).** The hard part is never the comparison — it's
_where snapshots live_, exactly as our queue note says.

**Relevance.** The comparison logic is easy for us (we already have a structural
serializer and `deep6` deep-equality). The storage backend is the whole
problem, and it is the **same storage problem as perf baselines and run
history** (§4.6, §4.7): a keyed, committable artifact store, filesystem on
CLI runtimes, and a `tape6-server` endpoint for browsers (our plugin contract
already supports a `/--snapshots/` fixture that writes to the dev machine's
disk — the only browser option that yields a committable artifact). On Node, we
can also _delegate_ to `node:test`'s stable `t.assert.snapshot` per the BYO
principle, rather than reimplement.

**Verdict.** **Tier 3 (core feature, needs the storage-interface design
first).**

- Design a single **snapshot storage interface** — `read(key)`, `write(key,
value)`, `list()` — with two backends: `fs` (Node/Bun/Deno, `__snapshots__`
  convention for familiarity) and `server` (a `/--snapshots/` plugin for
  browsers). One core comparison + serializer path over a pluggable backend.
- Adopt the settled conventions rather than inventing: an `--update-snapshots`
  flag (map to a `TAPE6_UPDATE_SNAPSHOTS` env for cross-runtime), **refuse to
  create snapshots in CI**, pluggable serializers, default `__snapshots__/*`
  layout.
- Steal Playwright's **reviewable patch-file** update UX as the differentiator —
  it fits a suite that wants snapshots committed and reviewed.
- Evaluate **delegating to `node:test` `t.assert.snapshot` on Node** as an
  alternative to a home-grown fs backend (BYO principle).
- Defer inline snapshots (source-rewriting) — highest complexity, four-runtime
  source-mutation surface, lowest incremental value. Ship file snapshots first.

This unblocks the queue's snapshot item with a concrete plan, and the storage
interface it defines is reused by §4.6 and §4.7.

### 4.6 Performance-regression-as-a-test (the nano-bench synergy)

**State.** Perf-regression testing has matured into a distinct discipline:

- **In-runner benchmarking** _(verified):_ Vitest's `bench` is built on
  **Tinybench** (Tinybench is the common wall-time microbenchmarking substrate;
  the feature remains experimental). Deno bench and standalone `tinybench` /
  `mitata` round out the set.
- **Statistical methodology** _(verified — a focused second pass confirmed these
  against the vendors' own docs)._ The field splits into three tiers of
  sophistication. (a) **Naive ratio** — `github-action-benchmark` performs _no_
  significance test at all; it alerts when the current result exceeds the single
  previous one by an `alert-threshold` percentage (default 200%). This is the
  anti-pattern to beat. (b) **Configurable threshold models over a windowed
  baseline** — **Bencher** offers seven tests: static, percentage, z-score,
  t-test, log-normal, IQR, and delta-IQR. The z-score/t-test/log-normal are
  parametric; **IQR and delta-IQR are nonparametric Tukey median+interquartile
  fences**, and **log-normal is offered specifically for positively-skewed
  latency data** — i.e. Bencher already ships exactly the distribution-free
  and skew-aware options tape-six's philosophy argues for. (c) **Changepoint
  detection over the time series** — **Nyrkiö** extends github-action-benchmark
  with the nonparametric **E-Divisive Means** algorithm (Matteson & James, JASA
  2014), tuned in practice with p=0.001 and a 5% magnitude floor to suppress
  false positives. Separately, **CodSpeed** sidesteps CI noise by _instrumentation_
  (`--codspeed-mode simulation`: Valgrind/Callgrind CPU simulation, single
  deterministic run, ignores warmup/rounds, no I/O or syscalls) as an alternative
  to its own wall-time mode. **criterion.rs** remains the reference design:
  bootstrap confidence intervals against a saved baseline.

The consensus best practice for noisy CI: don't threshold on a single wall-time
delta; either instrument for determinism, or compare distributions
statistically against a baseline with an effect-size floor, or detect
changepoints over a time series.

**Relevance.** This is where `nano-benchmark` is a strategic asset, not a
coincidence. Its entire design is the nonparametric, baseline-relative,
raw-samples-as-truth methodology these services charge for. "Performance
regression is part of testing" (the project owner's framing) becomes:
`t.bench(name, fn)` collects samples during a run, compares against a committed
baseline using **Mann-Whitney U for significance _and_ a median-ratio effect-
size floor** (significance alone flags trivial deltas in a big sample — the
effect floor is what makes it a _regression_ gate), gated by nano-bench's
existing **environment-comparability check** (`diffEnvironments` + `bodyHash`)
so a machine-confounded comparison never reads as clean.

The blocker is a dependency cycle: nano-bench's own tests use tape-six, so
tape-six cannot take `nano-benchmark` as an npm dependency. The resolution is
§5 — extract the stats kernel into a vendored package both projects share.

**Verdict.** **Tier 2/4 (plugin now, deeper integration later), gated on §5.**

- Extract the stats kernel (§5); verified this session to be **zero external
  imports**, so extraction is clean.
- A `t.bench` capability via `registerTesterMethod`, backed by the shared stats
  package, comparing against a baseline stored through the **same storage
  interface** as snapshots (§4.5): `fs` on CLI runtimes, `/--bench/` server
  plugin for browsers.
- Regression rule: MW U significance **and** a configurable median-ratio floor,
  behind the environment-comparability gate. Don't gate on wall-time alone.
- Wall-time only (we can't do CodSpeed-style instrumentation portably) — so
  lean on paired sampling within one run and the effect-size floor to survive
  noise; document the limitation honestly.
- The perf baseline file should reuse nano-bench's schema-v1 shape (raw samples
  the source of truth, recomputed on read) so `nano-bench-compare` can consume
  tape-six's baselines directly.

### 4.7 Test-run history / time series

**State.** Flaky-test analytics is a mature product category, and a focused
research pass verified concrete prior art for both the _record shape_ and the
_policies_:

- **Buildkite Test Engine** gives a concrete per-test JSON schema tape-six can
  model local history on: `{name (required), scope, location "path:line",
file_name, result, failure_reason, failure_expanded, history (required), tags}`,
  where `result` is a four-value enum (**passed/failed/skipped/unknown**) and
  `history` stores timing at two granularities — an aggregate `{start_at, end_at,
duration}` (duration a float in seconds) plus a `children[]` array of span
  objects (http/sql/sleep/annotation, down to individual query durations).
- **Datadog Test Optimization** detects flakiness on the default branch over a
  **30-day rolling window** and separates two states: **Quarantine** (the test
  still runs but cannot break the build — `is_quarantined:true`) vs **Disable**
  (skipped entirely).
- **Trunk Flaky Tests** deliberately avoids one built-in algorithm in favor of
  composable per-branch **monitors** — Pass-on-Retry (fails then passes on the
  same commit), Failure Rate (exceeds a % over a window), Failure Count
  (accumulates in a rolling window) — combined into a Broken > Flaky > Healthy
  priority.
- **Atlassian's Flakinator** is the richest single design: per-run **duration,
  environment, results, retry attempts, and error messages**, with a 0–1
  flakiness score by **Bayesian inference over a moving window** plus a
  configurable implicit-retry on not-yet-flagged failures.

The common thread — and the part that matters for us — is a small **one record
per (test, run)** shape: outcome (adopt Buildkite's enum), duration, environment,
retries, error. Exactly a JSONL-append line or a SQLite row. The analytics —
flip-rate, windowed flakiness score, duration drift — are statistics over that
table.

**Relevance.** This is a natural tape-six feature with a decisive structural
advantage: **browser runs already funnel through Node-side drivers**
(`tape-six-puppeteer` / `-playwright`) and the CLI runners, so a _server-side_
history store covers every runtime with no browser-storage problem. We already
emit a structured JSONL event stream with per-test timing; capturing history is
mostly _persisting what we already produce_, plus a git-rev stamp. And the
analytics layer is, again, `nano-benchmark`'s statistics (§5) pointed at a
different table: duration drift via Mann-Whitney U between time windows, a
windowed flakiness score, multiple-comparison correction (Holm/BH) across many
tests.

**Verdict.** **Tier 4 (opt-in utility + the web-UI story of §6).**

- Capture at the **runner level**: append one JSONL record per (test, run) —
  `{test, file, result, durationMs, env, ts, gitRev?, retries?}` with `result`
  the Buildkite-style enum (passed/failed/skipped/unknown) — behind an opt-in
  flag. Local-first, committable-or-gitignored at the user's choice. Follow
  nano-bench's philosophy: raw records are truth; scores are recomputed on read.
- An analysis path (CLI first, then the web UI of §6) computes flakiness and
  duration drift. Two verified models to draw on: **Trunk's composable monitors**
  (pass-on-retry, failure-rate, failure-count over a window — simple, explainable,
  the recommended default) and **Flakinator's Bayesian moving-window score**
  (a Beta-Binomial posterior over pass/fail flips — we have the beta functions in
  the stats kernel). Duration drift via MW U between time windows; slowest/most-
  failing rankings fall out for free.
- Storage backend: the **same interface** as §4.5/§4.6 — `fs`/JSONL for CLI,
  a `/--history/` server plugin for the browser/UI path. Optional SQLite is a
  later backend if scale demands; JSONL-append is the zero-dep default.
- Retry/quarantine (the product-grade layer) is a _later_ consideration and
  couples to a retry API (§4.8); start with capture + read-only analytics.

### 4.8 Other emerging features worth attention

**State + verdicts**, briefly, since these are smaller:

- **Type testing** (`expectTypeOf`/`assertType` via `expect-type`, used by
  Vitest as an _experimental_ integration; `tsd`; `attest`). Type-level
  assertions run at type-check time, not runtime — a different execution model
  from our TAP runner. **Verdict: Tier 0/Watch.** BYO via a wiki note (run
  `tsd`/`expect-type` alongside; they're their own tools); a runtime framework
  shouldn't absorb a type-check-time tool. Reconsider only if a compelling
  runtime-surfaced shape appears.
- **In-source testing** (`if (import.meta.vitest)`). Neat, but it couples tests
  into shipped source and leans on bundler dead-code elimination. **Verdict:
  Watch/Reject** — at odds with our clean-separation instinct; low demand.
- **Test sharding across machines** (`--shard=i/n` + a blob reporter +
  merge; node:test's `{index,total}`). Genuinely useful and mechanically simple
  for a parallel runner. **Verdict: Tier 3.** Add a `--shard i/n` to the CLI
  that partitions the discovered file list deterministically; the JSONL reporter
  is already a mergeable blob format. Low complexity, real CI value, fits the
  runner we have.
- **Retry / repeats API** (`test.retry(n)`, `test.repeats(n)`). node:test
  still lacks native retry; Vitest/Jest have it. Useful, and a prerequisite for
  the quarantine layer of §4.7. **Verdict: Tier 3.** A per-test `retry`/`repeat`
  option with faithful TAP reporting (retries as diagnostics; final outcome
  counts). Design against `t.plan` and skip/todo interactions (the queue's open
  question for "test inversion").
- **test.only / inversion / expected-failure** (already a queued "research"
  item). The field norm: `only` to focus, `failing`/`fails` to mark
  expected-failing tests that _fail if they pass_. **Verdict: Tier 3**, folded
  with the retry design — one coherent pass over test-modifier semantics
  (`only`, `failing`, `retry`, `repeat`) against `t.plan` and skip/todo.
- **AI-assisted test generation / self-healing tests.** Emerging, mostly
  external tooling and IDE/agent-side, not a framework primitive — and the TDD
  post is pointedly skeptical of agents optimizing for green. **Verdict:
  Reject/Watch.** Nothing to build into core; our contribution to the
  agent-testing story is _honest signal_ (accurate counts, clear failures,
  the materialized-invariant path of `tape-six-invariant`), not test generation.
- **TAP 14 + conformance verification (foundational).** What TAP 14 actually
  specifies (corrected after verification — the earlier draft overstated the
  version line): it standardizes **nested subtests** as child streams **indented
  4 spaces per nesting level, terminated by a single correlated test point in
  the parent**, optionally introduced by a `# Subtest` comment; YAML diagnostic
  blocks (schema left implementation-defined); `todo`/`skip` non-failing;
  `1..0` = wholly skipped. It "adds no features not already in wide use" —
  mostly formalizing practice. **Correction (refuted claims):** a `TAP version
14` declaration line is **not** strictly required as the first line, and
  node-tap does **not** always emit one — so do not treat a mandatory version
  line as a compliance gate. Emitting `TAP version 14` is _interop-helpful_
  (some consumers want it) but optional; if we emit it, strip it from indented
  subtest streams (some consumers reject an indented version line).
  **Verdict: Tier 1, and a prerequisite for the TAP-interop recommendations
  elsewhere.** Two parts, in order: **(a) verify conformance** — our TAP output
  has never been run through an actual verifier (§2), so first validate the
  current stream against real TAP consumers/validators (the `tap` parser /
  `node-tap`'s parser, `prove`, a TAP-14 validator) across a representative
  suite — passing, failing, skip, todo, nested, bail-out, YAML-diagnostic cases
  — and fix whatever is non-conformant. This is the load-bearing step: §4.3's
  StrykerJS spike and §4.7's analytics ingestion both assume a consumer can
  parse us, and that assumption is currently untested. **(b) align to TAP 14** —
  once conformance is verified, match the 4-space subtest nesting + YAML-
  diagnostic mechanics (and optionally emit the version line) so we're maximally
  consumable. Build a small conformance check into our own CI (feed our output
  to an independent parser and assert it round-trips) so conformance stops being
  an assumption and becomes a tested invariant. Low-to-moderate effort, broad
  interop payoff, and it de-risks every TAP-consumer integration in this doc.

## 5. Proposal: a vendored statistics package

**The decision this enables** (project owner, this session): _when tape-six
needs to pull in code, prefer a git submodule like `deep6`, not an npm
dependency._ And specifically: a **statistics package vendored by both
`tape-six` and `nano-benchmark`.**

**Why it's the right shape.**

- It dissolves the dependency cycle. nano-bench's tests use tape-six, so
  tape-six can't `npm`-depend on nano-benchmark. A _third_ package both vendor
  breaks the cycle cleanly.
- It's verified extractable. The nano-bench stats layer — `stats.js`,
  `median.js`, `stream-stats.js`, `stream-median.js`, `significance/*`
  (Mann-Whitney U, Kruskal-Wallis, Conover-Iman, corrections, KS), `stats/*`
  (the distribution/PPF/gamma/erf/zeta math), `utils/prng.js` — has **zero
  external imports** (confirmed this session). nano-bench's actual dependencies
  (`commander`, `console-toolkit`, `emoji-regex`, `get-east-asian-width`) are
  all CLI/rendering, not stats. The kernel lifts out whole.
- It preserves zero-dep. Vendored-and-copied like `deep6` (submodule →
  build-time copy into a gitignored `src/<name>/`), tape-six keeps its
  no-runtime-dependency posture while gaining a real statistics engine.

**Shape.**

1. New repo (e.g. `nano-stats` / `deep-stats`) = the extracted kernel, zero-dep,
   its own tests (using tape-six — fine; it's a leaf).
2. `nano-benchmark` vendors it as a submodule, replacing its inline `src/stats*`
   / `significance/` / `stats/` — nano-bench becomes stats-kernel + CLI/render.
3. `tape-six` vendors the same submodule (alongside `deep6`), copied at build
   into a gitignored `src/<name>/`. The **hands-off rule already documented for
   `deep6`** (`projects/tape-six/feedback.md`: never edit either copy; changes
   go upstream; exclude from sweeps) applies verbatim — one more vendored tree
   under the same discipline.
4. tape-six's `t.bench` (§4.6) and run-history analytics (§4.7) import from the
   copied kernel; still zero npm deps.

**Caveats to weigh before committing.** Extracting churns nano-bench (a working,
published tool) for tape-six's benefit — sequence it so nano-bench is
refactored and green _before_ tape-six consumes the kernel. Vendoring adds a
second submodule + build-copy step to tape-six's setup (already present for
deep6, so marginal). And the kernel's API becomes a shared contract across two
consumers — version it deliberately. None of these is blocking; they're
sequencing notes.

## 6. Proposal: run history + the test-running web UI

**The direction** (project owner, this session): if we do run history / time
series, explore a **`tape6-server`-based web UI** for it, folded into the
existing queued _"web application for test running"_ (selective running, reruns,
result viewing).

Today's `web-app/` is a thin fire-once runner (§2). The queue already wants it
to grow selective/on-demand running. History is the second layer on that same
surface. So this is **one web-UI evolution with two stacked deliverables**, not
a bolt-on:

**Layer A — modernize the runner UI (needed regardless of history).**

- Interactive, discoverable test selection driving the _existing_ plumbing
  (`/--patterns` already resolves `?q=` patterns to a file list — the UI just
  drives it instead of the user typing a URL). This closes the discoverability
  gap from §2, not a new capability.
- On-demand run / re-run / re-run-failed, a parallelism control, live results —
  the web-app already has the reporter + `TestWorker` machinery.
- A face-lift (the app is due one on its own merits).

**Layer B — history/analytics views on top.**

- A **`/--history/` server plugin** (the fixture-plugin `fetch` contract from
  `dev-docs/pluggable-test-server.md`): `POST` a run's records, `GET`
  trends/flakiness/durations. This is the browser-side storage backend from
  §4.7, and the same plugin family as the `/--snapshots/` and `/--bench/`
  backends (§4.5/§4.6) — one storage substrate, three consumers.
- web-app pages: per-test history sparkline, flakiness ranking, duration-drift
  trend, slowest/most-failing tables. The stats come from the §5 kernel.

**Why the server-plugin route fits.** The pluggable server was built for
exactly this (fixtures mounting under `/--<name>/`, longest-prefix routing,
embeddable core). History/snapshots/bench are three fixtures over one storage
substrate. And because browser runs already report through Node-side drivers,
the server owns the disk and every runtime's data lands in one place.

**Sequencing.** Layer A stands alone and is worth doing first (it's a queued
want independent of history). Layer B lands after the history-capture format
(§4.7) and the stats kernel (§5) exist. The `/--history/` plugin can ship and
be driven by a CLI reader before the UI is built, so history is usable
headless first, pretty second.

## 7. Tiers and sequencing

**Tier definitions.**

- **Tier 0 — docs/verify:** wiki pages, a verification spike; no core change.
- **Tier 1 — recognition/output:** small, safe core tweaks (recognize a shape,
  align output); no new API surface.
- **Tier 2 — plugin/sister package:** separate package via
  `registerTesterMethod` / the ambient protocol; core stays zero-dep.
- **Tier 3 — core feature:** a real addition to the runner/core; needs design,
  four-runtime porting, maintenance.
- **Tier 4 — infrastructure-backed:** depends on the stats kernel (§5) and/or
  the storage/UI substrate (§6).

**Suggested order** (each step is independently shippable; earlier steps
de-risk later ones):

0. **TAP conformance verification (foundational, do first).** Run tape-six's
   TAP output through an independent verifier/validator across a representative
   suite; fix non-conformance; wire a round-trip conformance check into CI
   (§4.8a). Everything that routes through TAP interop — the StrykerJS spike,
   analytics ingestion — depends on this, and it's currently an untested
   assumption. Cheap to start, and the highest-leverage de-risking step.
1. **Tier 0 cluster (now, no code):** wiki pages for fast-check
   scheduler/model-based + metamorphic testing; the StrykerJS-TAP-runner
   verification spike + its wiki page (gated on step 0); the fuzzing-boundary
   note. Cheapest value; sharpens the BYO story immediately.
2. **Tier 1 cluster:** align TAP 14 output (4-space subtest nesting, YAML
   diagnostics, optionally the version line — §4.8b, after step 0 confirms a
   clean baseline); fast-check failure-shape recognition in the reporter.
3. **Flagship plugin (Tier 2):** `tape-six-fast-check` (`t.prop` + scheduler).
   Proves the plugin pattern under a real popular dependency; highest
   user-visible payoff.
4. **The stats extraction (§5):** refactor nano-bench to the vendored kernel,
   green, published; then tape-six vendors it. Unblocks 5–7.
5. **Snapshots (Tier 3, §4.5):** the storage-interface design + `fs` backend +
   `t.matchSnapshot`; patch-file update UX; `/--snapshots/` browser backend.
   Defines the storage interface reused next.
6. **`t.bench` (Tier 2/4, §4.6):** on the stats kernel + the storage interface;
   MW U + effect-size floor + environment gate.
7. **Test-modifier pass (Tier 3, §4.8):** `only` / `failing` / `retry` /
   `repeat` semantics against `t.plan` and skip/todo, in one coherent design.
   Also add `--shard i/n`.
8. **Run history + web UI (Tier 4, §6):** capture format → `/--history/` plugin
   - CLI reader → web-app Layer A modernization → Layer B analytics views.

**Explicitly not doing** (recorded so the question doesn't reopen): a bundled
assertion/PBT/generator library; a fuzzing engine; a DST engine; a mutation
engine; inline (source-rewriting) snapshots in v1; type-checking-time assertions
in core; AI test generation. Each is either a platform-foundation concern, a
commodity someone else maintains better, or against the guardrails — and for
each, the BYO/plugin/recognition path gives users the capability without the
maintenance debt.

## 8. Open questions for the owner

1. **Stats extraction appetite.** §5 churns a working, published nano-bench.
   Worth it for the shared kernel, or keep the kernel in nano-bench and have
   tape-six vendor _nano-bench's_ subtree directly (narrower, but couples
   tape-six to nano-bench's layout)?
2. **Snapshot scope for v1.** File snapshots only (recommended), or is the
   inline-snapshot source-rewriting worth the four-runtime cost sooner?
3. **History storage default.** JSONL-append (zero-dep, recommended) as the
   only v1 backend, with SQLite as a later opt-in — or is SQLite worth pulling
   in (vendored) from the start for query ergonomics?
4. **`t.bench` home.** A `tape-six-bench` sister package (keeps core lean), or
   core `t.bench` given the stats kernel is vendored anyway?

These are the decisions that shape the build; everything else above follows
from them.

### Research status: gaps closed, one residual

A focused second research pass **closed three of the four gaps** the first pass
left open — the findings are folded into §4.4/§4.6/§4.7 above and are now
verified against primary sources:

- **CI perf-regression statistics** — CLOSED. Bencher's seven tests (with the
  nonparametric IQR-fence and skew-aware log-normal options), Nyrkiö's E-Divisive
  changepoint detection, CodSpeed's simulation-vs-wall-time modes, and
  github-action-benchmark's naive-ratio anti-pattern are confirmed. It also
  settles a design question: CodSpeed-style instrumentation is not portable, so
  tape-six commits to wall-time plus rank-based/changepoint statistics.
- **Metamorphic + fuzz/PBT hybrids** — CLOSED. Metamorphic testing is a
  specialization of PBT (layer on `t.prop`); CGPT/FuzzChick is the research-grade
  coverage-guided hybrid. §4.4 updated.
- **Local-first history schema + policies** — CLOSED. Buildkite's per-test JSON
  schema (result enum + two-granularity history), Datadog's quarantine/disable
  states, and Trunk's composable monitors are confirmed. §4.7's record shape and
  flakiness models now rest on these.

**Residual (minor):** **Bun / Deno native snapshot + bench API specifics** (file
formats, update flags, serializers) and browser snapshot-storage approaches
remain sourced-from-vendor-docs but not adversarially re-verified — confirm the
exact flags when designing §4.5's storage interface. This does not block the
storage-interface design, only the runtime-delegation details.
