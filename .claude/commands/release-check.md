---
description: Pre-release verification checklist for tape-six
---

# Release Check

Run through this checklist before publishing a new version of tape-six.

## Steps

1. Check that `ARCHITECTURE.md` reflects any structural changes (if present).
2. Check that `AGENTS.md` is up to date with any rule or workflow changes.
3. Check that `.windsurfrules`, `.clinerules`, `.cursorrules` are in sync with
   `AGENTS.md` (run `/sync-ai-rules` if not).
4. Check that `llms.txt` and `llms-full.txt` are up to date with any API changes
   (run `/ai-docs-update` if not).
5. Check that `TESTING.md` is up to date with the current API.
6. Check that `index.js` and `index.d.ts` are in sync (all exports, all types).
7. **Three-skill structure for `write-tests`** — tape-six ships three SKILL.md
   files for different audiences (see `projects/tape-six/learnings.md` §
   Three-skill structure in the vault):
   - `skills/write-tests/SKILL.md` — npm consumers (imports `from 'tape-six'`).
     Shipped via `package.json` `files` entry `skills`.
   - `.claude/skills/write-tests/SKILL.md` and
     `.windsurf/skills/write-tests/SKILL.md` — dev-internal pair, must be
     byte-identical (imports `from '../index.js'`).
8. Verify `package.json`:
   - `files` array includes all necessary entries (`index.*`, `bin`, `web-app`,
     `src`, `llms.txt`, `llms-full.txt`, `TESTING.md`, `skills`).
   - `bin` entries cover all CLI utilities.
   - `exports` map is correct.
   - `description` and `keywords` are current.
9. Check that the copyright year in `LICENSE` includes the current year.
10. Bump `version` in `package.json` (semver based on the nature of changes
    since the last tag — `git log <last-tag>..HEAD`).
11. Update release history. Check **both** locations and update each one that
    exists. They serve different audiences and carry different densities — see
    the cross-project rule at [[topics/two-tier-release-notes]] in the vault.
    - `README.md` — **cliff-notes**: the 1–2–3 most memorable items for users,
      comma-separated. Optional `Thx [Contributor](https://github.com/handle)`
      credit when the release responds to a specific issue or PR. No internal
      changes, no devDep bumps, no test counts, no CI moves. **One footer line
      at the bottom of the section, after the bullet list** (separated by a
      blank line, once per section, not per release). Exact wording is flexible
      (`The full release notes are in the wiki: [Release notes](...)`,
      `For more info consult full [release notes](...)`, etc. — all in use
      across the fleet); the placement is the rule.
    - `wiki/Release-notes.md` — the canonical longer-form history. A paragraph
      per substantive release with **bold** feature names; cover internal
      changes, calibration notes, related wiki / repo updates, and credits.
      Per-release date in the heading (use `git for-each-ref --sort=-creatordate
      --format='%(refname:short) %(creatordate:short)' refs/tags`).
      The wiki is a git submodule — it gets its own commit + parent-pointer bump.
    Don't update only the README — readers who follow the "for more info"
    link land on a stale page if you do.
12. Check that `wiki/Home.md` links to all relevant wiki pages.
13. **Sweep dependencies for staleness.** Run `npm outdated` and bump anything
    with a newer major or minor available. For libraries this is non-negotiable —
    stale ranges generate user complaints when consumers run a different version
    of the same dep. See [[dep-version-freshness]] in the vault for the full
    rationale and the "when adding" half of the rule.
14. Run `npm install` (or `npm install --package-lock-only`) to regenerate
    `package-lock.json` after any bumps from step 13.
15. **Cross-runtime test sweep:**
    - `npm test` (Node, parallel)
    - `npm run test:bun` (Bun, parallel)
    - `npm run test:deno` (Deno, parallel)
    - `npm run test:seq` (Node, sequential)
    - `npm run test:seq:bun` (Bun, sequential)
    - `npm run test:seq:deno` (Deno, sequential)
16. Run TypeScript check: `npm run ts-check`.
17. Run lint: `npm run lint`.
18. Dry-run publish to verify package contents: `npm pack --dry-run`.
19. Stop and report — do **not** commit, tag, or publish without explicit
    confirmation from the user.
