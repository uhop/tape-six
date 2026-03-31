# Replacing `process.exit()` with `process.exitCode`

## Why avoid `process.exit()`

`process.exit()` terminates the process immediately. Pending asynchronous operations
are abandoned — most importantly, buffered `process.stdout.write()` calls may never
reach the terminal. This causes truncated output, especially visible with Bun's async
stdout implementation.

Setting `process.exitCode` instead tells the runtime which code to return **after** the
event loop drains naturally. This lets all pending I/O complete before the process exits.

## Runtime support

| Runtime           | Set exit code without exiting | Notes                                                                                                 |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Node.js**       | `process.exitCode = N`        | Stable, well-documented. The process exits with this code when the event loop has nothing left to do. |
| **Bun**           | `process.exitCode = N`        | Supported via Node.js compatibility.                                                                  |
| **Deno**          | `process.exitCode = N`        | Works via the Node compat layer (`import process from 'node:process'`).                               |
| **Deno** (native) | `Deno.exitCode = N`           | Native API, available since Deno 1.23. No need to import `node:process`.                              |

All three runtimes support `process.exitCode`. For Deno you can optionally use
`Deno.exitCode` directly, but if you already import `process` from `node:process`,
`process.exitCode` works fine and keeps the code uniform.

## Flush stdout before setting the exit code

Even with `process.exitCode`, the event loop may drain before the last `write()` callback
fires. Explicitly flush stdout first:

```js
await new Promise(resolve => process.stdout.write('', resolve));
process.exitCode = hasFailed ? 1 : 0;
```

The empty-string `write('')` enqueues a callback that resolves only after all previously
buffered data has been written. Awaiting it guarantees the output is complete before the
exit code is set and the function returns.

## Conversion pattern

### Before

```js
const main = async () => {
  // ... run tests ...
  const hasFailed = reporter.state && reporter.state.failed > 0;
  if (hasFailed) process.exit(1);
};
main();
```

### After

```js
const main = async () => {
  // ... run tests ...
  const hasFailed = reporter.state && reporter.state.failed > 0;
  await new Promise(r => process.stdout.write('', r));
  process.exitCode = hasFailed ? 1 : 0;
};
main().catch(error => console.error('ERROR:', error));
```

The key changes:

1. Replace `process.exit(N)` with `process.exitCode = N`.
2. Add the stdout flush **before** setting the exit code.
3. Make sure the top-level call has a `.catch()` so errors are visible.

## When `process.exit()` is still appropriate

Not every `process.exit()` should be replaced. Keep it in these cases:

- **`uncaughtException` handler** — the process is in an undefined state; it should
  terminate immediately.
- **Fatal server errors** — e.g., `EACCES` or `EADDRINUSE` on `server.listen()`.
  The process cannot do useful work and should stop.
- **CLI early exits** — `--help`, `--version`, `--self` print a message and exit.
  These run before any async work starts, so there is nothing to flush.
  (For Deno, use `Deno.exit(0)` instead of `process.exit(0)`.)

## Deno-specific notes

- Deno's `--help`/`--version`/`--self` exits use `Deno.exit()` (not `process.exit()`)
  because those code paths run before the Node compat layer is meaningfully engaged.
- For test-result exit codes, `process.exitCode` works through the Node compat layer.
  Optionally set `Deno.exitCode` alongside it for defense-in-depth.
- Deno's `addEventListener('error', ...)` replaces Node's
  `process.on('uncaughtException', ...)`. Unlike Node's handler, Deno's error event
  does not suppress the default exit behavior, so there is no need to call `Deno.exit(1)`
  inside it.
