# Sister assert library — design note

Status: **core additions landed 2026-06-26; the package itself is not yet
built.** The three tape-six core hooks (host slot, `getTester` export,
`Tester.reportAssertion`) are in `index.js` / `src/Tester.js` / `index.d.ts`. The
sister package `tape-six-invariant` — a separate, zero-dependency
module carrying `assert`-style invariant checks that **materialize** into real
tape6 assertions when a tape6 run is hosting them, and are inert (or a
configurable behavior) otherwise — remains to be written. The library never
imports tape-six; it knows only the global protocol below.

## The idea

An invariant check embedded in production or library code:

```js
import {check} from 'tape-six-invariant'; // zero-dep, tiny

export function transfer(from, to, amount) {
  check(amount > 0, 'amount must be positive');
  check(from.currency === to.currency, 'currencies must match');
  // …
}
```

- **Under a tape6 run** (the code is exercised by a test): each `check()`
  becomes a counted assertion on the _current_ test — in the plan, in TAP
  output, with source location pointing at the `check()` call site.
- **In production** (no tape6): a configurable behavior. Default **inert** (does
  nothing). Overridable to throw, defer to `node:assert`, warn, or anything
  else.

The same call site means the same thing — an invariant — and is paid for only
when something is listening. This routing-to-a-live-harness is the one new
element vs. the prior art, which is always-on-or-stripped.

## What tape-six already provides

- **Assertions are `Tester` methods** that call
  `this.reporter.report({operator, name, fail, data:{expected, actual}, marker:
new Error()})`. The `marker` Error is how the reporter recovers source location.
- **A current-tester stack** (`src/test.js`): `testers` is pushed before a test
  body runs and popped after, with embedded `t.test` recursing through
  `runTests`, so `getTester()` returns the innermost live tester at any
  synchronous point in code called (directly or transitively) from a test body.
  This is what lets production code find "the current test" without
  AsyncLocalStorage (which tape6 avoids — not available in browsers, the binding
  constraint).
- **`registerTesterMethod(name, fn)`** — idempotent plugin hook on
  `Tester.prototype`.
- **Zero dependencies** (`dependencies: null`; deep6 is vendored). The sister
  library must hold the same line.

## Coordination: a global protocol slot

The library and tape6 coordinate through a **versioned, Symbol-keyed slot on
`globalThis`**, not a module-scoped registry:

```js
const KEY = Symbol.for('tape6.invariant.host.v1');
```

**Why a global rather than a `setHost()` module variable:** in production the
dependency graph can contain several copies/versions of the library (it is
embedded in multiple libraries a project pulls in; npm does not always dedupe
across version ranges). The coordination point must be shared across _all_
copies. A `globalThis` slot is; a module-scoped variable is not — each
duplicated copy has its own. Same reasoning as the React DevTools global hook,
`regenerator-runtime`, and `core-js` shared state.

**tape6 sets the slot (landed, `index.js`):**

```js
globalThis[Symbol.for('tape6.invariant.host.v1')] ||= {
  version: 1,
  report(assertion) {
    const tester = getTester(); // live current tester; null between/outside tests
    if (tester) tester.reportAssertion(assertion);
  }
};
```

- Installed at **module load**, not in `init()`, so the library's `hasHost`
  snapshot (below) is reliable: a test file imports tape-six first, so the slot
  exists before any code-under-test (and its embedded `check()` calls) runs.
  This is the install-before-use lesson from the React DevTools hook.
- `||=` so the first-loaded tape6 copy wins; redundant copies are functionally
  identical, so first-wins is safe and idempotent.
- The adapter reads `getTester()` **live per call**, so a check binds to the
  innermost running test and no-ops between tests — no per-test bind/unbind.

**The library side (to build):**

```js
const KEY = Symbol.for('tape6.invariant.host.v1');

export const hasHost = !!globalThis[KEY]; // plain boolean snapshot at import

export function check(cond, message) {
  const host = globalThis[KEY]; // the only cost when off: one property read
  if (host) {
    host.report({ok: !!cond, message, marker: new Error()}); // marker at call site
    return;
  }
  if (!cond) absentBehavior(cond, message);
}
```

`hasHost` is an import-time snapshot — a cheap constant callers use to gate
**expensive pre-check computation**:

```js
if (hasHost) check(expensiveToCompute(), 'invariant holds');
```

Correctness never depends on the snapshot: `check()` itself reads the live slot.
`hasHost` is reliable because tape6 sets the slot at module load and test files
import tape-six first; in pure production the slot is absent and `hasHost` is
`false`.

**Cross-realm:** `Symbol.for` is shared within a realm, but each realm (worker
thread, iframe, subprocess) has its own `globalThis`. tape6 already runs per
worker/process and isolates per realm, so each realm's load sets its own slot —
the model already fits.

## tape-six core additions (landed 2026-06-26)

1. **Host slot set in `index.js` at module load** — unconditionally (`||=`);
   harmless and cheap if no library reads it.
2. **`getTester` exported** from the main entry (previously only on the `./src/*`
   subpath).
3. **`Tester.prototype.reportAssertion(assertion)`** — a marker-preserving
   report primitive. The descriptor is
   `{ok, message?, marker?, operator?, expected?, actual?}`; with no
   `operator`/`expected`/`actual` it behaves like `assert`/`ok`
   (`operator: 'ok'`, `expected: true`, `actual: ok`), and the provided `marker`
   makes the reported location point at the production call site rather than the
   adapter. It is an **integration primitive, not a user-facing assertion** —
   the `info` (operator/expected/actual) is formed by the integration (the
   invariant package, or a future richer one), never by end users.

## Behaviors and configuration

`check()` resolves to exactly one of:

- **Materialized** — host present → routed to the current tester. Automatic.
- **Absent** — no host (production) → the configurable behavior, default no-op.

The absent behavior is a **single generic setter** — deliberately not a fixed
menu of env-flag-selected modes, so a user can do anything (throw, log to a
sink, sample, increment a metric):

```js
setAbsentBehavior((ok, message) => {
  if (!ok) throw new InvariantError(message);
});
```

Enforcement polarity is `if (!ok)`. Canned behaviors ship as **exported
functions passed to the setter**, not magic strings:

| Canned        | Behavior                                                               | Use                                         |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| _(default)_   | `() => {}`                                                             | Ship invariants into prod at zero cost      |
| `throwOnFail` | throw `InvariantError(message)` on `!ok`                               | Fail-fast enforcement                       |
| `nodeAssert`  | lazy `import('node:assert').ok` (Node-only; degrades to `throwOnFail`) | Node services wanting `AssertionError`+diff |
| `warnOnFail`  | `console.warn` on `!ok`                                                | Non-fatal telemetry signal                  |

## Zero-overhead-when-off

- **Off path is one global property read** plus an early return; the marker
  `Error`, descriptor object, and any comparison happen only on the materialized
  path. The `hasHost` constant lets callers skip expensive pre-check work
  entirely when nothing is listening.
- **Lazy message** — accept a `() => string` message thunk (tiny-invariant's
  trick) so an expensive message is not built unless the check fails.
- **Build-time strip** as the belt-and-suspenders guarantee: `check()` is a
  plain named import, so an unassert-style AST transform can delete the calls
  entirely in release builds. Keep the call signature **static and
  recognizable** (no dynamic dispatch) so such a transform stays feasible; a
  recommended config can ship with the package.

## API surface (v1)

Deliberately minimal:

```ts
function check(cond: unknown, message?: string | (() => string)): asserts cond;
```

The TS `asserts cond` signature gives callers type-narrowing. There is **no
user-facing `info` parameter** — `operator`/`expected`/`actual` are formed
internally when the package builds the `reportAssertion` descriptor.

**Deferred:** the equality family (`deepEqual`, `match`, …) is _not_ in this
package. Deep comparison needs an engine (deep6 inside tape6), which would force
either a dependency or a silent shallow downgrade in production — making the same
invariant mean different things in test vs. prod. A richer package that emulates
the full `Tester` assertion API can come later, forming richer descriptors for
`reportAssertion`; this one stays predicate-only and zero-dep.

## Open questions

- Function name (`check` vs `invariant` vs `assert` — `assert` may mislead since
  the default is inert, not throwing). (Package name settled: `tape-six-invariant`.)
- Whether the lazy-message thunk is in v1 or deferred.

## Prior art

- **[tiny-invariant](https://github.com/alexreardon/tiny-invariant)** — minimal
  falsy→throw invariant; lazy message function; drops `sprintf` to stay tiny;
  relies on the bundler to strip the dev-message block via
  `process.env.NODE_ENV`; `asserts cond` TS narrowing. _Borrow:_ lazy-message
  thunk, minimalism, TS signature. _Differs:_ always throws; ours defaults inert
  and is materialized.
- **[zertosh/invariant](https://github.com/zertosh/invariant)** (the fbjs
  pattern) — descriptive messages in dev, replaced by a generic error in prod by
  a build transform; the dev-rich/prod-lean duality is the point. _Borrow:_ that
  duality maps onto materialized vs. absent. _Avoid:_ its env-dependent pass/fail
  (throws if message omitted in dev) — we never let environment change a verdict.
- **[unassert](https://github.com/unassert-js/unassert)** /
  [babel-plugin-unassert](https://github.com/unassert-js/babel-plugin-unassert)
  (+ rollup/webpack/browserify variants) — removes node:assert-compatible
  assertions from the AST at build time: "write assertions in production code,
  compile them away." _Borrow:_ our build-time-strip path; keep `check()`
  statically matchable.
- **[node:assert](https://nodejs.org/api/assert.html)** — standard always-on
  assertion API; `AssertionError` carries `actual`/`expected`/`operator`.
  _Borrow:_ the `nodeAssert` canned behavior and the error-shape template for the
  descriptor's `expected`/`actual`/`operator`.
- **React DevTools global hook**
  ([design PR #22053](https://github.com/facebook/react/pull/22053),
  [installGlobalHook.js](https://github.com/facebook/react-devtools/blob/master/backend/installGlobalHook.js))
  — DevTools installs `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` before React loads;
  each renderer registers itself with that global on init; two
  independently-shipped packages coordinate purely through a well-known global,
  and registration is missed if the hook is absent at load. _Borrow:_ the
  canonical precedent for global-slot coordination across separately-published
  copies, and the install-before-use timing rule (why tape6 sets the slot at
  module load).
