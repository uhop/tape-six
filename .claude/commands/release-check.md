---
description: Pre-release verification checklist for tape-six
---

# Release Check

Run through this checklist before publishing a new version.

## Steps

1. Check that `ARCHITECTURE.md` reflects any structural changes.
2. Check that `AGENTS.md` is up to date with any rule or workflow changes.
3. Check that `.windsurfrules`, `.clinerules`, `.cursorrules` are in sync with `AGENTS.md`.
4. Check that `wiki/Home.md` links to all relevant wiki pages.
5. Check that `wiki/Release-notes.md` is updated with the new version.
6. Check that `llms.txt` and `llms-full.txt` are up to date with API changes.
7. Check that `TESTING.md` is up to date with the current API.
8. Check that `skills/write-tests/SKILL.md` is up to date (shipped to consumers via npm).
9. Check that `.claude/skills/write-tests/SKILL.md` and `.windsurf/skills/write-tests/SKILL.md` are byte-identical (dev-internal, used when working on this repo; they import from `../index.js`).
10. Verify `package.json`:
    - `files` array includes all necessary entries (`index.*`, `bin`, `web-app`, `src`, `llms.txt`, `llms-full.txt`, `TESTING.md`, `skills`).
    - `bin` entries cover all CLI utilities.
    - `exports` map is correct.
11. Check `index.js` and `index.d.ts` are in sync (all exports, all types).
12. Check that the copyright year in `LICENSE` includes the current year.
13. Bump `version` in `package.json`.
14. Update release history in `README.md`.
15. Run `npm install` to regenerate `package-lock.json`.
16. Run full test suite with Node: `npm test`
17. Run tests with Bun: `npm run test:bun`
18. Run tests with Deno: `npm run test:deno`
19. Run sequential tests with Node: `npm run test:seq`
20. Run sequential tests with Bun: `npm run test:seq:bun`
21. Run sequential tests with Deno: `npm run test:seq:deno`
22. Run TypeScript check: `npm run ts-check`
23. Run lint: `npm run lint`
24. Dry-run publish: `npm pack --dry-run`
