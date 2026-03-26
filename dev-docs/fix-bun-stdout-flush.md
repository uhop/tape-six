# Fix: Bun stdout not flushed before process.exit()

## Bug description

When running `tape6-proc` (or any tape-six runner) under Bun, the final summary banner is missing from the output. The TTY reporter writes the banner via `process.stdout.write()`, but `process.exit()` terminates the process before Bun flushes its internal stdout buffer.

### Reproduction

```bash
cd ../stream-json/   # or any project with many tests
bun run ../tape-six-proc/bin/tape6-proc.js --flags FO
# => final banner is missing
```

The bug is easier to observe with larger test suites (more buffered output).

## Root cause

`process.exit()` kills the event loop immediately, dropping any buffered stdout data. In Node.js, TTY writes are synchronous so this isn't a problem. In Deno, a prior fix added `await new Promise(r => process.stdout.write('', r))` before `process.exit()` — this works because Deno's write callbacks fire after prior queued writes drain. **Bun fires the empty-string write callback immediately** without guaranteeing prior writes are flushed, so the same technique doesn't help.

## Prior art: the Deno flush fix

- **tape-six** commit `165a53b` — added `await new Promise(r => process.stdout.write('', r))` before `process.exit()` in `bin/tape6-deno.js` and `bin/tape6-seq.js`.
- **tape-six-proc** commit `40a2d28` — same fix in `bin/tape6-proc-node.js`.

## Affected files in tape-six

All runners that call `process.exit()` after reporter output:

| File                | Has flush?               | Affected by Bun bug?                         |
| ------------------- | ------------------------ | -------------------------------------------- |
| `bin/tape6-bun.js`  | **No**                   | **Yes** — no flush AND uses `process.exit()` |
| `bin/tape6-node.js` | No                       | No — Node flushes TTY writes synchronously   |
| `bin/tape6-seq.js`  | Yes (empty-string flush) | **Yes** — flush doesn't work for Bun         |
| `bin/tape6-deno.js` | Yes (empty-string flush) | N/A — Deno-only runner                       |

### Also affected (separate repo)

| File                                   | Has flush?               | Affected?                            |
| -------------------------------------- | ------------------------ | ------------------------------------ |
| `tape-six-proc/bin/tape6-proc-node.js` | Yes (empty-string flush) | **Yes** — flush doesn't work for Bun |

## Recommended fix

Replace `process.exit(code)` with `process.exitCode = code` at the final exit point of `main()` in each runner.

`process.exitCode` lets the event loop drain naturally. Once `main()` resolves, there are no open handles keeping the event loop alive (no timers, no open sockets, all subprocess promises settled), so the process exits cleanly after all pending I/O flushes.

Keep the existing `await new Promise(r => process.stdout.write('', r))` flush calls — they still help Deno and don't hurt Node or Bun.

## Specific changes required

### `bin/tape6-bun.js`

1. **Add flush before final exit** (it has none):

```javascript
// BEFORE (current code, around line 96-97):
reporter.report({
  type: 'end',
  test: 0,
  fail: hasFailed
});

process.exit(hasFailed ? 1 : 0);

// AFTER:
reporter.report({
  type: 'end',
  test: 0,
  fail: hasFailed
});

await new Promise(r => process.stdout.write('', r));
process.exitCode = hasFailed ? 1 : 0;
```

2. **Add flush to `--info` and "no files" exits** (they also have none):

```javascript
// --info exit (around line 79-80):
if (currentOptions.optionFlags['--info'] === '') {
  showInfo(currentOptions, files);
  await new Promise(r => process.stdout.write('', r));
  process.exitCode = 0;
  return;
}

// no files exit (around line 83-85):
if (!files.length) {
  console.log('No files found.');
  await new Promise(r => process.stdout.write('', r));
  process.exitCode = 1;
  return;
}
```

Note: `tape6-bun.js` needs `import process from 'node:process';` added if not already present — it currently uses the Bun global `process`. Check if the import is there; if not, add it to match other runners.

### `bin/tape6-node.js`

Change the final exit (around line 98):

```javascript
// BEFORE:
process.exit(hasFailed ? 1 : 0);

// AFTER:
await new Promise(r => process.stdout.write('', r));
process.exitCode = hasFailed ? 1 : 0;
```

Also add flush to `--info` exit (around line 70-72) and "no files" exit (around line 75-77) — they currently have no flush:

```javascript
if (currentOptions.optionFlags['--info'] === '') {
  showInfo(currentOptions, files);
  await new Promise(r => process.stdout.write('', r));
  process.exitCode = 0;
  return;
}

if (!files.length) {
  console.log('No files found.');
  await new Promise(r => process.stdout.write('', r));
  process.exitCode = 1;
  return;
}
```

### `bin/tape6-seq.js`

Change the final exit (around line 109-110):

```javascript
// BEFORE:
await new Promise(r => process.stdout.write('', r));
process.exit(hasFailed ? 1 : 0);

// AFTER:
await new Promise(r => process.stdout.write('', r));
process.exitCode = hasFailed ? 1 : 0;
```

Also change `--info` exit (around line 79-82) and "no files" exit (around line 85-88):

```javascript
// --info: replace process.exit(0) with:
process.exitCode = 0;
return;

// no files: replace process.exit(1) with:
process.exitCode = 1;
return;
```

### `bin/tape6-deno.js`

Same pattern — change `Deno.exit(code)` / `process.exit(code)` to `process.exitCode = code` followed by `return` at `--info` and "no files" exits, and just `process.exitCode = code` at the final exit.

Note: `Deno.exit()` should also be replaced with `process.exitCode` for consistency. Deno supports `process.exitCode` via its Node compatibility layer.

## Important: use `return` not `process.exit()` for early exits

When replacing `process.exit(code)` inside `main()` for the `--info` and "no files" paths, use `return` after setting `process.exitCode` instead of leaving bare `process.exitCode`. This ensures `main()` actually returns and the event loop can drain. Without `return`, execution would fall through to subsequent code.

## Testing

After applying changes:

```bash
npm test          # Node
npm run test:bun  # Bun
npm run test:deno # Deno
npm run lint      # Prettier check
```

Also test with a larger project to verify the banner appears:

```bash
cd ../stream-json/
bun run ../tape-six/bin/tape6.js --flags FO
bun run ../tape-six-proc/bin/tape6-proc.js --flags FO
```

## Critical: auto-run exit in `index.js`

The `testRunner` function in `index.js` is the auto-run code that executes when a test file is run directly (not via a configured runner). This is exactly what happens in **every child process spawned by `tape6-proc`**.

At the end of `testRunner`, there is:

```javascript
if (!getConfiguredFlag()) {
  if (isDeno) {
    runHasFailed && Deno.exit(1);
  } else if (isBun) {
    runHasFailed && process.exit(1);
  } else if (isNode) {
    runHasFailed && process.exit(1);
  }
}
```

This calls `process.exit(1)` when tests **fail** — right after `reporter.report({type: 'end', ...})` writes the final JSONL event via `console.log()`. Under Bun, this can truncate the JSONL pipe before the parent process receives all events.

### Fix for `index.js`

Replace the `process.exit(1)` calls with `process.exitCode = 1`:

```javascript
// BEFORE:
if (!getConfiguredFlag()) {
  if (isDeno) {
    runHasFailed && Deno.exit(1);
  } else if (isBun) {
    runHasFailed && process.exit(1);
  } else if (isNode) {
    runHasFailed && process.exit(1);
  }
}

// AFTER:
if (!getConfiguredFlag() && runHasFailed) {
  if (isDeno) {
    process.exitCode = 1;
  } else if (isBun || isNode) {
    process.exitCode = 1;
  }
}
```

Or more simply:

```javascript
if (!getConfiguredFlag() && runHasFailed) {
  process.exitCode = 1;
}
```

This works across all runtimes: Node, Bun, and Deno (via its Node compatibility layer).

### Why this matters for `tape6-proc`

When `tape6-proc` spawns child processes under Bun, each child runs `index.js`'s `testRunner`. If a child has test failures, `process.exit(1)` can truncate its JSONL output, causing the parent to receive incomplete data. Even though the parent's banner generation is independent, incomplete JSONL from children can lead to incorrect result aggregation.

More importantly, even for **passing** tests, the child process exits naturally — but if Bun doesn't flush `console.log()` output before natural exit either, JSONL data can still be lost intermittently. This explains why the bug is intermittent even after fixing only the main process.

## Notes

- The `showSelf`, `showVersion`, `showHelp` functions also call `process.exit(0)`. These are fine — they only output a small amount via `console.log()` which is flushed synchronously even in Bun. But for full consistency, they could also be changed to `process.exitCode = 0; return;` if desired.
- `tape-six-proc/bin/tape6-proc-node.js` has already been fixed in the tape-six-proc repo. The change is identical: `process.exitCode` instead of `process.exit()` at all exit points in `main()`.
