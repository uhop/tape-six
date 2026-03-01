# AGENTS.md — tape-six

> `tape-six` is a TAP-based unit testing library for modern JavaScript (ES6+). It works in Node, Deno, Bun, and browsers. It runs ES modules natively and supports TypeScript without transpilation.

For project structure, module dependencies, and the architecture overview see [ARCHITECTURE.md](./ARCHITECTURE.md).
For detailed usage docs and API references see the [wiki](https://github.com/uhop/tape-six/wiki).

## Setup

This project uses git submodules:

```bash
git clone --recursive git@github.com:uhop/tape-six.git
cd tape-six
npm install
npm run build
```

`npm run build` copies files from the `vendors/deep6` submodule into `src/deep6/` (which is gitignored).

## Commands

- **Install:** `npm install`
- **Build:** `npm run build` (copies deep6 dependency from submodule)
- **Test (Node):** `npm test` (runs `tape6 --flags FO`)
- **Test (Bun):** `npm run test:bun`
- **Test (Deno):** `npm run test:deno`
- **Test (Puppeteer):** `npm run test:puppeteer` (requires `npm start` running in another terminal)
- **Test (Playwright):** `npm run test:playwright` (requires `npm start` running in another terminal)
- **Start browser test server:** `npm start` (runs `tape6-server --trace` on port 3000)
- **Lint:** `npm run lint` (Prettier check)
- **Lint fix:** `npm run lint:fix` (Prettier write)
- **TypeScript check:** `npm run ts-check`

## Project structure

```
tape-six/
├── index.js          # Main entry point, exports test, hooks, aliases
├── index.d.ts        # TypeScript definitions for the full public API
├── package.json      # Package config; "tape6" section configures test discovery
├── bin/              # CLI utilities: tape6, tape6-server, tape6-node, tape6-bun, tape6-deno, tape6-seq
├── src/              # Source code
│   ├── test.js       # Core test registration and execution
│   ├── Tester.js     # Tester class with all assert methods
│   ├── OK.js         # Expression evaluator helper
│   ├── State.js      # Reporter state management
│   ├── reporters/    # TAP, TTY, JSONL, Proxy, DOM reporters
│   ├── runners/      # Runtime-specific test runners
│   ├── utils/        # Timers, console capture, defer, etc.
│   └── deep6/        # Copied from vendors/deep6 at build time (gitignored)
├── web-app/          # Browser test UI application
├── tests/            # Test files (test-*.js, test-*.mjs, test-*.cjs)
├── ts-tests/         # TypeScript test files
├── wiki/             # GitHub wiki documentation (submodule)
├── vendors/          # Git submodules (deep6)
├── prompts/          # AI prompt templates for documentation generation
└── scripts/          # Build helper scripts
```

## Code style

- **ES modules** throughout (`"type": "module"` in package.json).
- **No transpilation** — code runs directly in all target runtimes.
- **Prettier** for formatting (see `.prettierrc`).
- Semicolons are enforced by Prettier (default `semi: true`).
- Imports at the top of files, using `import` syntax.
- The package name is `tape-six` but internal names, environment variables, and public names use `tape6` (e.g., `TAPE6_FLAGS`, `tape6` CLI).

## Architecture

- `index.js` is the main entry point. It auto-detects the runtime (Node/Deno/Bun/browser), selects the appropriate reporter, and starts the test runner.
- `test()` function registers test suites. It is also aliased as `suite()`, `describe()`, and `it()`.
- The `Tester` object is passed to test functions and provides all assert methods.
- Tests are TAP-compatible and can output TAP, TTY (colored), or JSONL formats.
- `tape6` CLI runs test files in parallel using worker threads. `tape6-seq` runs them sequentially in-process.
- Browser tests use `tape6-server` which serves files and a web UI. Automated browser testing uses Puppeteer or Playwright scripts in `tests/`.
- The `deep6` dependency is vendored via git submodule and copied into the source tree at build time.

## Writing tests

```js
import test from 'tape-six';

test('example', t => {
  t.ok(true, 'truthy');
  t.equal(1 + 1, 2, 'math works');
  t.deepEqual([1, 2], [1, 2], 'arrays match');
});
```

- Test files should be directly executable: `node tests/test-foo.js`
- Test file naming convention: `test-*.js`, `test-*.mjs`, `test-*.cjs`, `test-*.ts`, `test-*.mts`, `test-*.cts`.
- Tests are configured in `package.json` under the `"tape6"` section.

## Key conventions

- Do not add dependencies unless absolutely necessary — the library is intentionally minimal.
- All public API is exported from `index.js` and typed in `index.d.ts`. Keep them in sync.
- Wiki documentation lives in the `wiki/` submodule. See `prompts/doc.md` for documentation generation guidelines.
- Environment variables use the `TAPE6_` prefix.
- Browser integration exposes `__tape6_reportResults` for automation tools.
