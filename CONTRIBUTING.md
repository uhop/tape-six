# Contributing to tape-six

Thank you for your interest in contributing!

## Discuss significant changes first

Every significant change starts as a conversation. Before you write code, open a
[discussion](https://github.com/uhop/tape-six/discussions) or an
[issue](https://github.com/uhop/tape-six/issues) that describes the problem and the change you
propose, and wait for a maintainer to approve it explicitly. A pull request for a significant
change that wasn't discussed and approved first isn't merged, and may be closed without review.

A significant change is anything beyond a small fix: a new feature or option, a change to the
public API or to documented behavior, a new dependency, a refactor, or a change to the build, the
tests, or CI. Small fixes can go straight to a pull request: a typo, a broken link, or a bug fix
of a few lines with a test that fails without it.

The discussion saves your time as much as ours: a change that doesn't fit the project is cheaper
to turn down before it is written. Approval covers the plan you described, and the pull request is
still reviewed against it.

To report a security vulnerability, don't use a public discussion or issue: follow
[SECURITY.md](./SECURITY.md).

### What a change has to fit

Read the README and the [wiki](https://github.com/uhop/tape-six/wiki) first: they say what
tape-six is for and how it is meant to be used.

- **The project's purpose.** tape-six is a zero-dependency test runner with one core for Node,
  Deno, Bun, and browsers. A change that takes it outside that purpose, or that serves one
  application's special needs, belongs in a fork you maintain yourself. The license allows it, and
  for a special need it is the better path.
- **The cost of keeping it.** A merged change is maintained here from then on, by the maintainer:
  its author rarely comes back to fix what turns up later. Each feature also grows the API and the
  documentation every user has to learn. A change has to be worth that cost, and a feature can be
  declined for that reason alone.
- **Speed.** tape-six exists partly because other test runners are slow. A change to the runners,
  the reporters, or the assertions comes with timings before and after, and doesn't slow the
  common case.
- **One concern per pull request.** A pull request that mixes several changes goes back to its
  author to be split.

## Getting started

This project uses git submodules. Clone and build:

```bash
git clone --recursive https://github.com/uhop/tape-six.git
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

## License

This project is distributed under the [BSD-3-Clause license](./LICENSE).
External contributions are accepted only under licenses compatible with
BSD-3-Clause; submissions under fundamentally incompatible licenses cannot
be merged.

## AI agents

If you are an AI coding agent, see [AGENTS.md](./AGENTS.md) for detailed project conventions, commands, and architecture.
