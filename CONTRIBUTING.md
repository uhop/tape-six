# Contributing to tape-six

Thank you for your interest in contributing!

## Getting started

This project uses git submodules. Clone and build:

```bash
git clone --recursive git@github.com:uhop/tape-six.git
cd tape-six
npm install
npm run build
```

See [Working on this project](https://github.com/uhop/tape-six/wiki/Working-on-this-project) for details on the build system and architecture.

## Development workflow

1. Make your changes.
2. Format: `npm run lint:fix`
3. Test: `npm test`
4. Type-check: `npm run ts-check`

## Code style

- ES modules (`import`/`export`), no CommonJS in source.
- Formatted with Prettier — run `npm run lint:fix` before committing.
- No unnecessary dependencies.
- Keep `index.js` and `index.d.ts` in sync.

## AI agents

If you are an AI coding agent, see [AGENTS.md](./AGENTS.md) for detailed project conventions, commands, and architecture.
