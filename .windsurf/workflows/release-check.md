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
6. Check that `llms.txt` and `llms-full.txt` are up to date with any API changes.
7. Check that `TESTING.md` is up to date with the current API.
8. Check that `skills/write-tests/SKILL.md` is up to date (shipped to consumers).
9. Verify `package.json`:
   - `files` array includes all necessary entries (`index.*`, `bin`, `web-app`, `src`, `llms.txt`, `llms-full.txt`, `TESTING.md`, `skills`).
   - `bin` entries cover all CLI utilities.
   - `exports` map is correct.
10. Check that `index.js` and `index.d.ts` are in sync (all exports, all types).
11. Check that the copyright year in `LICENSE` includes the current year (e.g., update `2022` → `2022-2026` or `2005-2022` → `2005-2026`).
12. Bump `version` in `package.json`.
13. Update release history in `README.md`.
14. Run `npm install` to regenerate `package-lock.json`.
    // turbo
15. Run the full test suite with Node: `npm test`
    // turbo
16. Run tests with Bun: `npm run test:bun`
    // turbo
17. Run tests with Deno: `npm run test:deno`
    // turbo
18. Run sequential tests with Node: `npm run test:seq`
    // turbo
19. Run sequential tests with Bun: `npm run test:seq:bun`
    // turbo
20. Run sequential tests with Deno: `npm run test:seq:deno`
    // turbo
21. Run TypeScript check: `npm run ts-check`
    // turbo
22. Run lint: `npm run lint`
    // turbo
23. Dry-run publish to verify package contents: `npm pack --dry-run`
