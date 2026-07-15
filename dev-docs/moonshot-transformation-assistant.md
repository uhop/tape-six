# Moonshot — an interactive, invariant-aware code-transformation assistant

Status: **vision / feasibility, 2026-07-06; §6 library-declared laws added
2026-07-15.** A moonshot: an AI-agent-based
assistant that applies the semantics-preserving, readability-oriented code
transformations from the blog series — but interactively, advising and teaching
rather than silently rewriting, and reasoning about _libraries_ rather than only
whole programs. This doc grounds the idea in verified prior art and names where
the genuine novelty is, so it can be argued about before anything is built.

Companion reading: the blog series — _Code linearization_, _Logical
optimizations_, _Boolean algebra_, _Loop and `if` invariants_, _`break`/
`continue` is the new `goto`_ — is the transformation catalog. _TDD as religion_
and the invariants post supply the correctness philosophy. This doc connects
that series to `tape-six` (the test-as-oracle), `tape-six-invariant` (invariants-
as-contracts), and `nano-benchmark` (the measurement). External claims were
gathered and adversarially verified in focused research passes; sources cited
inline.

> This is deliberately a _vision_ doc. It argues the idea is well-founded and
> says where a tractable first slice is — it does not commit tape-six to
> building any of it.

## 1. The idea, in one paragraph

Take the manual code-simplification transformations a good programmer applies by
hand — flatten control flow, merge `if`s (exportation), apply De Morgan, drop
dead conditions and unused pure calls, make invariants explicit — and give them
to an agent that works _with_ the programmer on their _library_ source: it
proposes a change, explains why (the rule, the invariant it relied on), suggests
the code or **API** change that unlocks a better implementation, keeps the output
readable, and gates every rewrite on soundness (purity analysis + the test suite
as an equivalence oracle). The programmer's own words: "an AI agent could do that
if we can explain it to the agent somehow."

## 2. Why this is not "reinvent an optimizer" — the five deficiencies

The value proposition is not the transformations (those exist); it is five
things existing optimizers and minifiers _don't_ do. In the practitioner's words,
now each backed by the research:

1. **Closed-world / whole-program assumption; weak on libraries.** _Verified:_
   the whole-program assumption provably breaks for library code — GCC's LTO must
   assume it sees the whole program but rarely does, and ELF default symbol
   visibility lets any exported (non-`static`) symbol be interposed at runtime,
   which degrades interprocedural optimization for anything in a library's public
   interface (arXiv:1010.2196). Libraries are open-world; batch optimizers hate
   that. → An agent can reason about a module against _contracts/assumptions_
   without the whole program.

2. **They never suggest how to change the code (or API) to optimize better.**
   _Verified:_ the sole close prior art is **optimization coaching** (St-Amour,
   Tobin-Hochstadt, Felleisen, Findler, Guo — Typed Racket, OOPSLA 2012; a
   **JavaScript** version, ECOOP 2015; shipped as a DrRacket plugin). It coined
   the "compiler-to-programmer _dialog_," detects "near misses" (optimizations
   the compiler _could_ do if the source changed), and emits program-specific
   source-level recommendations — explicitly including **semantics-non-preserving**
   ones a compiler may never make, with the programmer free to veto. But it is
   tied to one language/optimizer, is **one-shot, not conversational**, and does
   **not reach open-world library API redesign** (its own scope: types/expressions
   inside one program). → API-level advice is exactly item 2, and it is the
   highest-value move; coaching gets closest and still stops short.

3. **They don't teach.** _Verified:_ the coaching literature articulates this
   precisely — conventional optimizers are an "impenetrable black box" that fails
   _silently_, so a programmer is never told an optimization failed and
   diagnosing why needs expert skills (auditing object code, reverse-engineering
   the optimizer). LLVM optimization remarks are the mature "why did it NOT
   optimize" channel (Passed/Missed/Analysis) — but they **describe, not
   prescribe**, and in October 2025 LLVM/Apple engineers themselves framed remarks
   as a "teaching tool" that still needs "more actionable remarks." → Pedagogy —
   surfacing the rule and the invariant — is a first-class output here, not an
   afterthought.

4. **Algorithm/source-level transforms decoupled from the backend.** _Verified:_
   the decoupling is a proven design point — Halide separates the _algorithm_
   (what) from the _schedule_ (how it maps to the machine); Lightweight Modular
   Staging (LMS) puts an optimizing-compiler framework at the library level (a
   naive FFT becomes a specialized generator by changing "literally two lines").
   But these are **language designs that require the programmer to author the
   low-level strategy** — not an advisory tool that _suggests_ it. → The moonshot
   works at the algorithm/source level and _advises_, orthogonal to whatever the
   engine does underneath.

5. **C/C++ paradigm → unreadable output.** _Verified by absence:_ every optimizer
   in the corpus targets size/speed and emits an artifact the programmer discards
   (§3). None documents a readability-oriented, teaching, or invariant-making
   transformation tool. → The moonshot's output is **readable source the
   programmer keeps and owns**; the transform is the visible, reviewable
   deliverable.

**The unifying conclusion (the practitioner's):** these are interactive,
judgment-laden, mixed-initiative problems — suggest, explain, redesign, negotiate
a contract — not batch analyses. A compiler is non-interactive by construction;
an agent is interactive by construction. That is the fit.

## 3. What the research establishes

Three layers, each verified, that together locate the opening.

### 3.1 The mechanical transforms are _solved_ — for machines

The source-expressible subset of the classical optimization catalog (constant
folding/propagation, SCCP, dead-code elimination, CSE/GVN, inlining, control-flow
and boolean simplification, tail-call) is **already implemented source-to-source**
for the size/speed goal:

- **Google Closure Compiler** — the canonical JS-to-JS optimizer, with a precise
  correctness guarantee at `SIMPLE` and only a _conditional_ one at `ADVANCED`
  (exactly where renaming/DCE/inlining break dynamic and interop semantics).
- **Terser / esbuild / babel-minify** — implement the catalog with conservative
  **purity/side-effect gating**; esbuild deliberately drops top-level TDZ edge
  cases, i.e. minifiers knowingly trade ECMAScript corners for bytes.
- **Partial evaluation** — the _formally_ semantics-preserving source-to-source
  paradigm (the "mix equation"): Prepack (Meta, industrial), SPEjs (academic).

So the moonshot must not rebuild these. The blog's mechanical rules are a solved
commodity — _for the opposite goal (bytes, hidden)_.

### 3.2 The transformation _theory_ is mature — but pure/bounded-only

- **e-graphs / equality saturation (egg, egglog)** — an open-source substrate
  that applies a whole rewrite catalog at once (solving phase-ordering), extracts
  an optimal term by a cost function, and **doubles as an equivalence checker**
  (add both sides, test same e-class; beat Z3 15–47× on one task). The commodity
  rewrite+equivalence engine to _adopt_.
- **CompCert** proves the exact blog transforms (inlining, constant propagation,
  CSE, if-conversion) semantics-preserving — but C→assembly, Coq proofs.
- **Souper / Alive2** — SMT-gated peephole/rewrite verification, but a pure,
  control-flow-free IR subset; Alive2 is bounded (unrolls loops), sound-but-
  incomplete.
- **Superfusion (SuFu, PLDI 2024)** — its authors say bounded verification is
  "unsuitable for compiler optimization," naming the exact soundness gap.
- **The JS/TS codemod tools (ast-grep, GritQL, jscodeshift/Babel/ts-morph)** are
  purely **syntactic** — no behavior-preservation guarantee. The mechanics exist;
  the soundness layer does not.

**The architectural template — LLMLIFT (NeurIPS 2024):** an LLM emits _both_ the
transformed program _and_ a correctness proof (summary + loop invariants), then
an SMT solver (cvc5/z3) verifies functional equivalence for _all_ inputs. The
canonical "LLM proposes, formal verifier gates" loop — but limited to
side-effect-free programs. **Purity is the enabling precondition** across Souper,
SuFu, and LLMLIFT: formal equivalence is only tractable on effect-free code.

### 3.3 The advisory / open-world / readable / interactive axes are _unspanned_

This is the finding that makes the moonshot more than a wish. Each prior art
covers **one** axis and misses the rest:

| Prior art                  |    advisory    | open-world library | readable/teaching  |  interactive  |
| -------------------------- | :------------: | :----------------: | :----------------: | :-----------: |
| Optimization Coaching      |       ✅       | ❌ (intra-program) | partial (explains) | ❌ (one-shot) |
| LLVM opt-remarks           | describe-only  |         ❌         |  ❌ (expert dump)  |      ❌       |
| Partial eval / LMS / weval | ❌ (automatic) | ✅ (library-level) |   ❌ (generated)   |      ❌       |
| Halide / staging           | ❌ (author it) |         ✅         |         ❌         |      ❌       |
| Minifiers / Closure        |       ❌       | ❌ (whole-program) |  ❌ (unreadable)   |      ❌       |

No single tool spans **advisory + open-world-library-aware + readable/pedagogical

- interactive/mixed-initiative** — and 2023-2026 LLM/agent-driven _interactive
  advisory_ refactoring is essentially **unrepresented** in the verified corpus.
  That empty intersection is precisely where the moonshot's differentiation
  concentrates.

## 4. The architecture

The research converges on one shape, shared with the invariants work:

**Agent proposes, oracle disposes, assume-until-proven.** This is the LLMLIFT
loop (transform + proof → SMT gate) and the LEMUR loop (invariants proposed →
sound verifier validates; LLM output is only an _assumption_ until proven, so an
unreliable proposer can't break soundness). The moonshot is that loop, adapted
for effectful JS where full proof is intractable:

1. **Propose.** The agent selects a transformation from the catalog (the blog
   rules, encoded — see §5) and applies it to a region, _and_ proposes the code/
   API change and the rationale (the rule + the invariant it leaned on).
2. **Gate on soundness, tiered by what's provable:**
   - **Provably-pure regions** → formal gate: an e-graph equivalence check or an
     Alive2-style SMT check (adopt the substrate; §3.2).
   - **Effectful regions (the JS majority)** → the **test suite as equivalence
     oracle** (`tape-six`): differential/property-based equivalence between the
     original and transformed code, plus mutation-style confidence. This is the
     honest substitute for proof — and Pass 3 found _no_ confirmed prior art
     establishing how good a test-oracle gate is, so it's both the pragmatic
     path and an open research question we're positioned to answer.
   - **Contracts** (`tape-six-invariant`) supply the assumptions a region is
     transformed _against_ — the LEMUR "assume-until-proven" premises.
3. **Purity/effect analysis is the gate that routes** — it decides which oracle
   applies. It is the genuinely hard part in JS (getters, proxies, `this`,
   prototype mutation, `eval`, coercion, exceptions, `arguments`), and source-
   level JS effect analysis is thin beyond conservative gating (SPEjs). Start
   conservative: only the clearly-pure gets the formal gate; everything else
   leans on the oracle and stays advisory (the human vetoes).
4. **Explain and keep readable.** Every accepted change ships with its rationale
   and reads as clean, owned source (recast/ts-morph/magic-string preserve
   comments and formatting for round-tripping).

**Build-vs-adopt** (the fleet rule — retire the commodity, keep the glue): _adopt_
the verified-rewrite substrate (an egg/egglog e-graph engine or an Alive2-style
SMT gate) and the AST tooling (Babel/ts-morph/recast); _rebuild_ the agent glue —
selecting, sequencing, explaining, and negotiating transformations — because that
glue is the entire value and nothing existing provides it.

## 5. "Explain it to the agent somehow" — encoding the catalog

The practitioner's hope hinges on this. The research answer (Pass 3 open
question) is concrete: encode the blog catalog as a set of **named,
machine-checkable rewrite rules with explicit side conditions**, e.g.

- `de-morgan`: `!(a && b) ⟺ !a || !b` — side condition: none (boolean algebra).
- `drop-unused-pure-call`: `f(x); → ∅` — side condition: **`f` is pure** (the
  purity gate) and the result is unused.
- `merge-ifs` (exportation): `if (a) { if (b) { S } } → if (a && b) { S }` —
  side condition: no `else`, no intervening statements.
- `guard-clause`: hoist a nested condition into an early `return` — side
  condition: the returned-past region establishes the block invariant.
- `flatten` / `linearize`: side condition: exit-set analysis (the `break`/
  `continue` post's discipline — each jump lands where the invariant still holds).

Each rule carries: a name, a pattern, side conditions (purity, short-circuit
soundness, independence, exit-set), the invariant it preserves, and a
teachable rationale. The agent _selects and sequences_ rules (judgment); the
_gate_ (formal on pure, oracle on effectful) discharges each step; the
_explanation_ is the rule + invariant surfaced to the programmer. This is the
bridge from "informal blog prose" to "an agent can apply it and something can
check it."

## 6. Library-declared laws — a second rule tier (2026-07-15)

§5's catalog is the _language-level_ algebra — universal rules that ship with
the tool. There is a second tier the research passes did not cover:
**library-authored laws** — equations only the library's author can assert
(associativity of a `concat`, the `empty` identities, functor composition),
shipped _with the package_ as machine-readable records. Origin: the
practitioner's Khepri recollection + Fantasy Land's axioms + static-land's
derivations (session 2026-07-15).

### 6.1 Prior art for this tier

- **Khepri** (Bierner, pre-ES6; _repo/wiki verified 2026-07-15_) — an
  ECMAScript rework for untyped functional-style programming compiling to
  plain JS with no runtime dependencies; "Khepri and Javascript can also be
  freely mixed"; function inlining documented as a compiler capability
  (`khepri-parse` / `khepri-compile`). An open-world, per-function compilation
  model — a prior-art point the §3 corpus missed. That its optimizer exploited
  Fantasy-Land-style algebraic structure (and sometimes mis-optimized) is the
  practitioner's recollection — _plausible, unverified_.
- **static-land** (_spec verified 2026-07-15_) — types as **modules of static
  functions** ("static meaning they don't use `this`"); laws as `≡` equations;
  a derivation lattice (Bifunctor/Profunctor/Applicative/Monad → `map`,
  Chain → `ap`, Traversable → `reduce` + `map`; a Monad's minimal base is
  `{of, chain}`); and a **consistency clause** — a module providing a
  derivable method anyway must keep its behaviour "equivalent to that of the
  derivation".
- **GHC `{-# RULES #-}`** (_training knowledge_) — the canonical "library
  ships rewrite rules to the optimizer" mechanism (map/map, foldr/build
  fusion); canonical weakness: rules are **trusted, never checked**.
- **clojure.spec** (_training knowledge_) — API + invariants as data,
  generative tests derived automatically; the verification half,
  ecosystem-proven.
- **fp-ts-laws / sanctuary-type-classes** (_training knowledge_) — JS law
  suites exist, but as hand-written _test code_, not shipped data. The gap.
- **`/*#__PURE__*/` + `sideEffects: false`** (_training knowledge_) — the one
  invariant annotation the JS ecosystem adopted at scale: one bit, one
  consumer (tree-shaking), immediate payoff. A _minimal_ vocabulary with a
  concrete consuming tool can spread.
- **QuickSpec** (_training knowledge_) — _discovers_ equational laws by
  testing; a bootstrap for law sets of existing libraries.

### 6.2 One artifact, three consumers

A law record — a name, both sides as expressions over bound variables, the
equivalence relation, side conditions — feeds:

1. **Verify** — compile the record to a property test (the
   `tape-six-fast-check` `t.prop` plugin the testing-directions doc already
   plans): quantify the bound variables over generators, compare sides with
   the type's own `equals`. Two auto-generated classes: base-set laws, and
   **consistency tests** (native ≡ derived) for every override. Derived
   methods are correct by construction — the verification surface shrinks to
   the minimal base plus overrides.
2. **Derive** — dictionary completion: `derive({of, chain})` returns the
   module with `map` / `ap` filled in from the spec's formulas. A plain
   runtime function; buildable today, no compiler.
3. **Optimize** — laws are undirected equations, which e-graphs (§3.2) take
   natively: both directions available, no orientation or phase-ordering
   choice — dissolving the mistake class the trusted-rules precedent warns
   about (attributing Khepri's mis-optimizations to this is _speculative_).
   The consistency clause licenses **specialization** (contract a derived
   generic form into the native optimized method) and **fusion** (expand into
   the base form, fuse with neighbours, re-extract).

**The trust story — the piece GHC RULES never had:** the rewriter may only
use a law the test suite has verified for that instance. This is §4's
assume-until-proven spine with the library's own axioms as the premises.

### 6.3 Soundness nuance: laws are quotient equivalences

Laws state equivalence **up to the type's own `equals`** — a quotient, not
`===`. Allocation, identity, timing, and any impurity in the methods escape
it. Law exploitation is therefore opt-in per lawful instance and still gated;
§4's tiers apply unchanged — the laws only add premises carrying a declared
equivalence relation.

### 6.4 Representation is load-bearing

static-land's module-of-static-functions style matters twice. No `this` and
explicit arguments is exactly the "clearly-pure region" §4's conservative
purity gate can approve — fantasy-land's method style drags in prototypes,
getters, and dynamic receivers. And statically-resolvable callees are what a
source-level optimizer can inline: `S.equals(a, b)` names its function;
`a['fantasy-land/equals'](b)` dispatches on an unknown receiver. Khepri's
inline-into-oblivion and static-land's derivations converge on one design
point: open-world, statically-referenced function dictionaries —
dictionary-passing, what Haskell type classes elaborate into.

### 6.5 Generalization: the invariants sidecar (2026-07-15)

Algebraic laws are one claim kind of a more general, optional artifact a
library ships next to its types: an **invariants sidecar** — working shape, a
Markdown file of a specified format (the `llms.txt` / `AGENTS.md` family,
maintainable by the same ai-docs tooling). Types under-specify:
`nano-binary-search`'s `.d.ts` gives
`(readonly T[], LessFn<T>, number?, number?) => number`, while everything that
matters — the sortedness precondition, the insertion-point semantics,
`result ∈ [l, r]`, the `splice` idiom — lives only in JSDoc prose. The sidecar
promotes that prose to executable, pattern-matchable claims.

The claim vocabulary, worked against the real `binarySearch` (which is
`std::partition_point`):

- **`pre:`** — the partition precondition (`lessFn` over `[l, r)` is
  `true* false*`; sortedness + a consistent `<`-predicate is one way to
  satisfy it) and range sanity. Declared _assumed, never checked_ — an O(n)
  check would defeat the O(log n) function; exactly the knowledge only a
  declaration can carry.
- **`post:`** — `l <= result <= r` (an insertion index, not a found index)
  and the partition-point functional spec, both executable predicates over
  `(args, result)`.
- **`effects:`** — pure; mutates nothing; calls only `lessFn`; deterministic.
  The `/*#__PURE__*/` bit generalized to a frame condition — the claim that
  licenses reorder/cache/drop.
- **`complexity:`** — at most `⌈log2(r − l)⌉ + 1` `lessFn` calls, O(1) space;
  verified by instrumented counting (wall-time claims via nano-benchmark).
- **`pattern:`** — named idioms as _trigger_ (what an agent recognizes:
  `push()` + `sort()` per insertion; `indexOf` on known-sorted data),
  _replacement_, _justification_ (which postcondition), and **obligation**
  (which precondition the call site must now establish).
- **`hazard:`** — negative knowledge: an inconsistent `lessFn` returns a
  silently meaningless index; reading the result as a found position without
  the equality check; a mutating `lessFn`.
- **`law:` / `derivation:`** — §6.1–6.2's algebraic kinds, when the module is
  typeclass-shaped. One format hosts both; the boundary is soft
  (partition-point is itself a relational equation).

The complete worked artifact:

````markdown
---
package: nano-binary-search
binds: ^1.0.14
export: 'binarySearch(sortedArray, lessFn, l = 0, r = sortedArray.length): number'
---

# binarySearch

Finds the partition point of `sortedArray` over `lessFn`: the smallest index in
`[l, r]` such that every earlier element satisfies `lessFn` and no element from
it on does. With `x => x < pivot` this is the lower bound; with
`x => x <= pivot` the upper bound (`std::partition_point` semantics).

## Preconditions

- `partitioned` (assumed, never checked at runtime; O(n) to verify): over
  `[l, r)`, `lessFn` values form `true* false*` - no `true` after a `false`.
  A sorted array queried with a consistent `<`-style predicate satisfies this.

  ```js check pre:partitioned
  (sortedArray, lessFn, l, r) => {
    let seenFalse = false;
    for (let i = l; i < r; ++i) {
      if (lessFn(sortedArray[i], i, sortedArray)) {
        if (seenFalse) return false;
      } else seenFalse = true;
    }
    return true;
  };
  ```

- `range`: `l` and `r` are integers with `0 <= l <= r <= sortedArray.length`.

## Postconditions

- `result-range`: `l <= result && result <= r`. Note `result` may equal
  `sortedArray.length`: it is an insertion index, not a found index.
- `partition-point`:

  ```js check post:partition-point
  (result, sortedArray, lessFn, l, r) => {
    for (let i = l; i < result; ++i) if (!lessFn(sortedArray[i], i, sortedArray)) return false;
    for (let i = result; i < r; ++i) if (lessFn(sortedArray[i], i, sortedArray)) return false;
    return true;
  };
  ```

## Effects

- `pure`: does not mutate `sortedArray`; calls nothing but `lessFn`;
  deterministic while `lessFn` is. Safe to reorder, cache, or drop when the
  result is unused.

## Complexity

- `log-calls`: at most `Math.ceil(Math.log2(r - l)) + 1` invocations of
  `lessFn`; O(1) space. Verify by counting calls with an instrumented `lessFn`
  over generated inputs.

## Patterns

### sorted-insert

- Trigger: maintaining order via `push()` + `sort()` per insertion, or a
  linear scan for the insertion index into a known-sorted array.
- Replacement:

  ```js
  const i = binarySearch(arr, x => x < value);
  arr.splice(i, 0, value);
  ```

- Justification: `partition-point` implies the splice preserves sortedness.
- Obligation at the call site: `arr` is sorted by the same ordering that
  `x => x < value` assumes (the `partitioned` precondition).

### membership

- Trigger: `indexOf()` / `findIndex()` / `includes()` on a known-sorted array.
- Replacement:

  ```js
  const i = binarySearch(arr, x => x < value);
  const found = i < arr.length && !(value < arr[i]);
  ```

- Justification: `result-range` + `partition-point`; equality is recovered as
  "neither less" under the same ordering.

## Hazards

- `inconsistent-order`: a `lessFn` inconsistent with the array's actual order
  violates `partitioned`; the function still returns an index, silently
  meaningless. No error is thrown.
- `insertion-index-misread`: using the result directly as the position of a
  found element without the `membership` equality check.
- `mutating-lessFn`: a `lessFn` that mutates the array mid-search voids all
  postconditions.
````

Consumption and trust: the library's own CI compiles `check`-bearing claims
into property tests (`t.prop` / fast-check) — claims are _verified, not
trusted_ (§6.2's RULES lesson). At a call site the agent inherits a pattern's
obligation, discharged by local reasoning or by inserting a
`tape-six-invariant` guard (inert in production, materialized in tests) — the
sister library is the runtime vehicle for `pre:` claims. The optimizer
consumes `effects:` / `law:` claims as rewrite licenses. Authoring is
symmetric: a human or an agent drafts claims from source and tests (the
artifact above was derived by reading `index.js`), the generated suite
validates them, the author blesses.

Prior art for the sidecar (_training knowledge_): Design by Contract (Eiffel
`require` / `ensure`); frame conditions (JML / ACSL / Dafny
`assignable` / `modifies`); .NET Code Contracts — the closest
one-source-many-consumers precedent (static checker + runtime checks + doc
injection); LiquidHaskell refinement types, which express "sorted input,
range-bounded output" in types — here shipped deliberately as _optional data_,
testable rather than provable; Rust doctests — executable usage examples in
docs, CI-run.

## 7. How the three projects are three legs of one stool

The moonshot is not a fourth, separate bet — it rests on the other three:

- **`tape-six`** is the **equivalence oracle**: the test suite that gates a
  transformation when formal proof is intractable (the effectful-JS common case).
  This is also why the doc lives here.
- **`tape-six-invariant`** supplies the **contracts** a region is transformed
  against, and its research (LEMUR-style assume-until-proven) is the _same_
  agent+oracle architecture — the invariants tool and the moonshot share a spine.
- **`nano-benchmark`** is the **measurement**: whether a transformation actually
  helped (or at least didn't regress) is a perf question answered by the shared
  nonparametric stats — the same `t.bench`/regression machinery the testing-
  directions doc proposes.

The blog series is the **knowledge base** the agent applies and teaches from.

## 8. Honest risks and open questions

- **The soundness gap for effectful JS is real and unsolved.** Every verified
  formal result is pure/bounded-only. The moonshot's bet is that a
  test-oracle + purity-gate + human-veto stack is a _sufficient practical_
  substitute — but Pass 3 found no confirmed evidence of how much confidence
  that actually buys. Quantifying it (mutation-style) would itself be a
  contribution.
- **Is the "interactive advisory refactoring" niche genuinely empty, or a search
  gap?** Pass 6 flags this as needing positive confirmation before the novelty
  claim is load-bearing — 2023-2026 moves fast. Re-survey before committing.
- **API-redesign advice is the highest-value and least-precedented axis.**
  Optimization coaching changes types/expressions _inside_ a program; suggesting
  a different _public interface_ so callers and implementations both improve is
  unconfirmed prior art and genuinely hard.
- **Purity analysis for JS is the make-or-break enabling tech**, and it is thin
  at the source level. A conservative-but-useful analyzer is a prerequisite, not
  a detail.

## 9. A tractable first slice (not the whole moonshot)

If any of this is pursued, the smallest honest starting point:

1. **Encode a handful of the safest catalog rules** (§5: De Morgan, double
   negation, merge-ifs, guard-clause) as named rewrites with side conditions,
   over a real AST (Babel/ts-morph) with readable round-tripping (recast).
2. **A conservative purity check** — start with "calls only known-pure built-ins
   and locals; no member writes, no `this`, no unknown calls" — and apply
   value-dropping rules _only_ in provably-pure regions.
3. **The test suite as the gate** — run the target's `tape-six` suite before and
   after each rewrite; a rewrite that changes any observable output is rejected
   and surfaced. (This is the `verify`-skill discipline applied to a transform.)
4. **Advisory + teaching output** — propose each change as a diff with its rule
   and invariant, for the human to accept or veto. No silent rewriting.

That slice is a _linter-plus-teacher_ that already does something no existing
tool does (readable, advisory, invariant-explaining, test-gated), and it grows
toward the open-world/API-redesign/interactive frontier from there — the axes
the research shows are empty.

**A pre-slice from §6 (2026-07-15):** the law/invariants tier has its own,
smaller standalone experiment — the invariants-sidecar format (§6.5), with the
static-land dictionary completer + law/consistency test generator as the
buildable-today core (claim records in; derived methods and `t.prop` suites
out).
Independently useful with nothing else built, and it produces exactly the
checked-equation records the rewriter would later consume as its per-library
rule tier. Filed on the tape-six queue.
