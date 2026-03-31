# Debugging the Bun TTY issue

Running the test script:

```bash
cd ../stream-json/
bun run ../tape-six-proc/bin/tape6-proc-node.js
```

It doesn't show the final banner. The output appears to be truncated.

## TTYReporter

The TTYReporter is responsible for rendering the progress bar and other terminal output.
While it is named after `TTY`, it can be used with regular files and pipes. If a stream
is a TTY, it inludes some enhancements: colors and cursor control. So it is unlikely
that the issue is specifically TTY-related.

The major difference between `TTYReporter` and other reporters is that it uses
`process.stdout.write()` instead of `console.log()`.

### Possible debugging directions

Set a different reporter to see if the issue is specific to TTYReporter and/or its use of
`process.stdout.write()`. For example, use JSONLReporter:

```bash
TAPE6_JSONL=1 bun run ../tape-six-proc/bin/tape6-proc-node.js
```

How to verify the output? Both `stream-json` and `stream-chain` can parse JSONL. If it is malformed,
e.g., truncated, the parser throws an error. Otherwise, it should produce a normal JSONL.

If everything works, the problem is in `process.stdout.write()`.

The next step would be to modify `JSONLReporter` temporarily and replace `console.log()`
with `process.stdout.write()` and see if the issue apppears. If it does, the bug is likely
in Bun's implementation of `process.stdout.write()`.

## Bun

If we confirm that the issue is in Bun's implementation of `process.stdout.write()`, we can try
to look at he Bun's code (it is an open source project) to see if it is a known issue or a bug.
Or there is a bug in the code. we do not control Bun but we can file a bug with a concise reproduction case.
If we are lucky and we can identify the root cause, we can try to fix it in our code with a workaround.
