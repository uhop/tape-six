# Moonshot — an interactive, invariant-aware code-transformation assistant

Status: **vision / feasibility, 2026-07-06.** A moonshot: an AI-agent-based
assistant that applies the semantics-preserving, readability-oriented code
transformations from the blog series — but interactively, advising and teaching
rather than silently rewriting, and reasoning about *libraries* rather than only
whole programs. This doc grounds the idea in verified prior art and names where
the genuine novelty is, so it can be argued about before anything is built.

Companion reading: the blog series — *Code linearization*, *Logical
optimizations*, *Boolean algebra*, *Loop and `if` invariants*, *`break`/
`continue` is the new `goto`* — is the transformation catalog. *TDD as religion*
and the invariants post supply the correctness philosophy. This doc connects
that series to `tape-six` (the test-as-oracle), `tape-six-invariant` (invariants-
as-contracts), and `nano-benchmark` (the measurement). External claims were
gathered and adversarially verified in focused research passes; sources cited
inline.

> This is deliberately a *vision* doc. It argues the idea is well-founded and
> says where a tractable first slice is — it does not commit tape-six to
> building any of it.

## 1. The idea, in one paragraph

Take the manual code-simplification transformations a good programmer applies by
hand — flatten control flow, merge `if`s (exportation), apply De Morgan, drop
dead conditions and unused pure calls, make invariants explicit — and give them
to an agent that works *with* the programmer on their *library* source: it
proposes a change, explains why (the rule, the invariant it relied on), suggests
the code or **API** change that unlocks a better implementation, keeps the output
readable, and gates every rewrite on soundness (purity analysis + the test suite
as an equivalence oracle). The programmer's own words: "an AI agent could do that
if we can explain it to the agent somehow."

## 2. Why this is not "reinvent an optimizer" — the five deficiencies

The value proposition is not the transformations (those exist); it is five
things existing optimizers and minifiers *don't* do. In the practitioner's words,
now each backed by the research:

1. **Closed-world / whole-program assumption; weak on libraries.** *Verified:*
   the whole-program assumption provably breaks for library code — GCC's LTO must
   assume it sees the whole program but rarely does, and ELF default symbol
   visibility lets any exported (non-`static`) symbol be interposed at runtime,
   which degrades interprocedural optimization for anything in a library's public
   interface (arXiv:1010.2196). Libraries are open-world; batch optimizers hate
   that. → An agent can reason about a module against *contracts/assumptions*
   without the whole program.

2. **They never suggest how to change the code (or API) to optimize better.**
   *Verified:* the sole close prior art is **optimization coaching** (St-Amour,
   Tobin-Hochstadt, Felleisen, Findler, Guo — Typed Racket, OOPSLA 2012; a
   **JavaScript** version, ECOOP 2015; shipped as a DrRacket plugin). It coined
   the "compiler-to-programmer *dialog*," detects "near misses" (optimizations
   the compiler *could* do if the source changed), and emits program-specific
   source-level recommendations — explicitly including **semantics-non-preserving**
   ones a compiler may never make, with the programmer free to veto. But it is
   tied to one language/optimizer, is **one-shot, not conversational**, and does
   **not reach open-world library API redesign** (its own scope: types/expressions
   inside one program). → API-level advice is exactly item 2, and it is the
   highest-value move; coaching gets closest and still stops short.

3. **They don't teach.** *Verified:* the coaching literature articulates this
   precisely — conventional optimizers are an "impenetrable black box" that fails
   *silently*, so a programmer is never told an optimization failed and
   diagnosing why needs expert skills (auditing object code, reverse-engineering
   the optimizer). LLVM optimization remarks are the mature "why did it NOT
   optimize" channel (Passed/Missed/Analysis) — but they **describe, not
   prescribe**, and in October 2025 LLVM/Apple engineers themselves framed remarks
   as a "teaching tool" that still needs "more actionable remarks." → Pedagogy —
   surfacing the rule and the invariant — is a first-class output here, not an
   afterthought.

4. **Algorithm/source-level transforms decoupled from the backend.** *Verified:*
   the decoupling is a proven design point — Halide separates the *algorithm*
   (what) from the *schedule* (how it maps to the machine); Lightweight Modular
   Staging (LMS) puts an optimizing-compiler framework at the library level (a
   naive FFT becomes a specialized generator by changing "literally two lines").
   But these are **language designs that require the programmer to author the
   low-level strategy** — not an advisory tool that *suggests* it. → The moonshot
   works at the algorithm/source level and *advises*, orthogonal to whatever the
   engine does underneath.

5. **C/C++ paradigm → unreadable output.** *Verified by absence:* every optimizer
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

### 3.1 The mechanical transforms are *solved* — for machines

The source-expressible subset of the classical optimization catalog (constant
folding/propagation, SCCP, dead-code elimination, CSE/GVN, inlining, control-flow
and boolean simplification, tail-call) is **already implemented source-to-source**
for the size/speed goal:

- **Google Closure Compiler** — the canonical JS-to-JS optimizer, with a precise
  correctness guarantee at `SIMPLE` and only a *conditional* one at `ADVANCED`
  (exactly where renaming/DCE/inlining break dynamic and interop semantics).
- **Terser / esbuild / babel-minify** — implement the catalog with conservative
  **purity/side-effect gating**; esbuild deliberately drops top-level TDZ edge
  cases, i.e. minifiers knowingly trade ECMAScript corners for bytes.
- **Partial evaluation** — the *formally* semantics-preserving source-to-source
  paradigm (the "mix equation"): Prepack (Meta, industrial), SPEjs (academic).

So the moonshot must not rebuild these. The blog's mechanical rules are a solved
commodity — *for the opposite goal (bytes, hidden)*.

### 3.2 The transformation *theory* is mature — but pure/bounded-only

- **e-graphs / equality saturation (egg, egglog)** — an open-source substrate
  that applies a whole rewrite catalog at once (solving phase-ordering), extracts
  an optimal term by a cost function, and **doubles as an equivalence checker**
  (add both sides, test same e-class; beat Z3 15–47× on one task). The commodity
  rewrite+equivalence engine to *adopt*.
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

**The architectural template — LLMLIFT (NeurIPS 2024):** an LLM emits *both* the
transformed program *and* a correctness proof (summary + loop invariants), then
an SMT solver (cvc5/z3) verifies functional equivalence for *all* inputs. The
canonical "LLM proposes, formal verifier gates" loop — but limited to
side-effect-free programs. **Purity is the enabling precondition** across Souper,
SuFu, and LLMLIFT: formal equivalence is only tractable on effect-free code.

### 3.3 The advisory / open-world / readable / interactive axes are *unspanned*

This is the finding that makes the moonshot more than a wish. Each prior art
covers **one** axis and misses the rest:

| Prior art | advisory | open-world library | readable/teaching | interactive |
| --- | :---: | :---: | :---: | :---: |
| Optimization Coaching | ✅ | ❌ (intra-program) | partial (explains) | ❌ (one-shot) |
| LLVM opt-remarks | describe-only | ❌ | ❌ (expert dump) | ❌ |
| Partial eval / LMS / weval | ❌ (automatic) | ✅ (library-level) | ❌ (generated) | ❌ |
| Halide / staging | ❌ (author it) | ✅ | ❌ | ❌ |
| Minifiers / Closure | ❌ | ❌ (whole-program) | ❌ (unreadable) | ❌ |

No single tool spans **advisory + open-world-library-aware + readable/pedagogical
+ interactive/mixed-initiative** — and 2023-2026 LLM/agent-driven *interactive
advisory* refactoring is essentially **unrepresented** in the verified corpus.
That empty intersection is precisely where the moonshot's differentiation
concentrates.

## 4. The architecture

The research converges on one shape, shared with the invariants work:

**Agent proposes, oracle disposes, assume-until-proven.** This is the LLMLIFT
loop (transform + proof → SMT gate) and the LEMUR loop (invariants proposed →
sound verifier validates; LLM output is only an *assumption* until proven, so an
unreliable proposer can't break soundness). The moonshot is that loop, adapted
for effectful JS where full proof is intractable:

1. **Propose.** The agent selects a transformation from the catalog (the blog
   rules, encoded — see §5) and applies it to a region, *and* proposes the code/
   API change and the rationale (the rule + the invariant it leaned on).
2. **Gate on soundness, tiered by what's provable:**
   - **Provably-pure regions** → formal gate: an e-graph equivalence check or an
     Alive2-style SMT check (adopt the substrate; §3.2).
   - **Effectful regions (the JS majority)** → the **test suite as equivalence
     oracle** (`tape-six`): differential/property-based equivalence between the
     original and transformed code, plus mutation-style confidence. This is the
     honest substitute for proof — and Pass 3 found *no* confirmed prior art
     establishing how good a test-oracle gate is, so it's both the pragmatic
     path and an open research question we're positioned to answer.
   - **Contracts** (`tape-six-invariant`) supply the assumptions a region is
     transformed *against* — the LEMUR "assume-until-proven" premises.
3. **Purity/effect analysis is the gate that routes** — it decides which oracle
   applies. It is the genuinely hard part in JS (getters, proxies, `this`,
   prototype mutation, `eval`, coercion, exceptions, `arguments`), and source-
   level JS effect analysis is thin beyond conservative gating (SPEjs). Start
   conservative: only the clearly-pure gets the formal gate; everything else
   leans on the oracle and stays advisory (the human vetoes).
4. **Explain and keep readable.** Every accepted change ships with its rationale
   and reads as clean, owned source (recast/ts-morph/magic-string preserve
   comments and formatting for round-tripping).

**Build-vs-adopt** (the fleet rule — retire the commodity, keep the glue): *adopt*
the verified-rewrite substrate (an egg/egglog e-graph engine or an Alive2-style
SMT gate) and the AST tooling (Babel/ts-morph/recast); *rebuild* the agent glue —
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
teachable rationale. The agent *selects and sequences* rules (judgment); the
*gate* (formal on pure, oracle on effectful) discharges each step; the
*explanation* is the rule + invariant surfaced to the programmer. This is the
bridge from "informal blog prose" to "an agent can apply it and something can
check it."

## 6. How the three projects are three legs of one stool

The moonshot is not a fourth, separate bet — it rests on the other three:

- **`tape-six`** is the **equivalence oracle**: the test suite that gates a
  transformation when formal proof is intractable (the effectful-JS common case).
  This is also why the doc lives here.
- **`tape-six-invariant`** supplies the **contracts** a region is transformed
  against, and its research (LEMUR-style assume-until-proven) is the *same*
  agent+oracle architecture — the invariants tool and the moonshot share a spine.
- **`nano-benchmark`** is the **measurement**: whether a transformation actually
  helped (or at least didn't regress) is a perf question answered by the shared
  nonparametric stats — the same `t.bench`/regression machinery the testing-
  directions doc proposes.

The blog series is the **knowledge base** the agent applies and teaches from.

## 7. Honest risks and open questions

- **The soundness gap for effectful JS is real and unsolved.** Every verified
  formal result is pure/bounded-only. The moonshot's bet is that a
  test-oracle + purity-gate + human-veto stack is a *sufficient practical*
  substitute — but Pass 3 found no confirmed evidence of how much confidence
  that actually buys. Quantifying it (mutation-style) would itself be a
  contribution.
- **Is the "interactive advisory refactoring" niche genuinely empty, or a search
  gap?** Pass 6 flags this as needing positive confirmation before the novelty
  claim is load-bearing — 2023-2026 moves fast. Re-survey before committing.
- **API-redesign advice is the highest-value and least-precedented axis.**
  Optimization coaching changes types/expressions *inside* a program; suggesting
  a different *public interface* so callers and implementations both improve is
  unconfirmed prior art and genuinely hard.
- **Purity analysis for JS is the make-or-break enabling tech**, and it is thin
  at the source level. A conservative-but-useful analyzer is a prerequisite, not
  a detail.

## 8. A tractable first slice (not the whole moonshot)

If any of this is pursued, the smallest honest starting point:

1. **Encode a handful of the safest catalog rules** (§5: De Morgan, double
   negation, merge-ifs, guard-clause) as named rewrites with side conditions,
   over a real AST (Babel/ts-morph) with readable round-tripping (recast).
2. **A conservative purity check** — start with "calls only known-pure built-ins
   and locals; no member writes, no `this`, no unknown calls" — and apply
   value-dropping rules *only* in provably-pure regions.
3. **The test suite as the gate** — run the target's `tape-six` suite before and
   after each rewrite; a rewrite that changes any observable output is rejected
   and surfaced. (This is the `verify`-skill discipline applied to a transform.)
4. **Advisory + teaching output** — propose each change as a diff with its rule
   and invariant, for the human to accept or veto. No silent rewriting.

That slice is a *linter-plus-teacher* that already does something no existing
tool does (readable, advisory, invariant-explaining, test-gated), and it grows
toward the open-world/API-redesign/interactive frontier from there — the axes
the research shows are empty.
