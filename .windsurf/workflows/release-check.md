---
description: Pre-release verification checklist for tape-six
---

# Release Check

Run through this checklist before publishing a new version.

## Steps

1. Check that `ARCHITECTURE.md` reflects any structural changes.
2. Check that `AGENTS.md` is up to date with any rule or workflow changes.
3. Check that `wiki/Home.md` links to all relevant wiki pages.
4. Check that `wiki/Release-notes.md` is updated with the new version.
5. Check that `llms.txt` and `llms-full.txt` are up to date with any API changes.
6. Verify `package.json`:
   - `files` array includes all necessary entries (`index.*`, `bin`, `web-app`, `src`, `llms.txt`, `llms-full.txt`).
   - `bin` entries cover all CLI utilities.
   - `exports` map is correct.
7. Check that `index.js` and `index.d.ts` are in sync (all exports, all types).
8. Bump `version` in `package.json`.
9. Update release history in `README.md`.
10. Run `npm install` to regenerate `package-lock.json`.
    // turbo
11. Run the full test suite: `npm test`
    // turbo
12. Run TypeScript check: `npm run ts-check`
    // turbo
13. Run lint: `npm run lint`
    // turbo
14. Dry-run publish to verify package contents: `npm pack --dry-run`
