import {runtime, getGraceTimeout} from './config.js';

// Control plane, child side (proc transport). A proc-spawned child is an
// ordinary test file run by this runtime; tape-six-proc marks it with
// TAPE6_CONTROL and talks to it over stdin (line-delimited, mirroring the JSONL
// data plane). The contract — see dev-docs/worker-control-channel.md:
//   - The pending stdin read keeps the event loop open, so the child stays
//     alive after emitting its top-level `end` and the parent decides when it
//     exits. That parent-driven exit is what closes the Bun stdout-flush race
//     (the child no longer self-exits while the parent's Web-Stream view of the
//     pipe is mid-teardown; see topics/tape-six-proc-bun-summary-suppressed).
//   - On a `terminate` line the child drains a running test via
//     reporter.terminate() (arms stopTest + fires the abort signal; cleanup
//     hooks still run).
//   - On control-channel EOF (parent done, died, or pipe broke) it soft-
//     terminates and lets the event loop empty for a natural, fully-flushed
//     exit. An unref'd watchdog is the hard backstop: it fires only if a hung
//     test keeps the loop alive past graceTimeout (e.g. the parent died before
//     it could force-kill).

const getStdinStream = async () => {
  switch (runtime.name) {
    case 'deno':
      return Deno.stdin.readable;
    case 'bun':
      return Bun.stdin.stream();
    case 'node': {
      const {Readable} = await import('node:stream');
      return Readable.toWeb(process.stdin);
    }
  }
  return null;
};

const exitProcess = code => {
  if (runtime.name === 'deno') {
    Deno.exit(code || 0);
  } else if (typeof process == 'object' && typeof process.exit == 'function') {
    process.exit(code || 0);
  }
};

const armWatchdog = (graceTimeout, getExitCode) => {
  const watchdog = setTimeout(() => exitProcess(getExitCode()), graceTimeout);
  // The watchdog must never keep the child alive on its own — it only matters
  // when something else (a hung test) does. Unref so a clean drain exits at once.
  if (typeof watchdog?.unref == 'function') {
    watchdog.unref();
  } else if (runtime.name === 'deno' && typeof Deno.unrefTimer == 'function') {
    Deno.unrefTimer(watchdog);
  }
};

export const listenControlChannel = async getReporter => {
  const stream = await getStdinStream();
  if (!stream) return;

  const graceTimeout = getGraceTimeout(),
    decoder = new TextDecoder(),
    reader = stream.getReader(),
    getExitCode = () =>
      typeof process == 'object' && typeof process.exitCode == 'number' ? process.exitCode : 0;

  let terminated = false;
  const handleLine = line => {
    const cmd = line.trim();
    if (!cmd) return;
    // Accept a bare `terminate` or a JSON {"cmd":"terminate","reason":...}.
    if (cmd === 'terminate') {
      terminated = true;
      getReporter()?.terminate();
    } else if (cmd[0] === '{') {
      try {
        const msg = JSON.parse(cmd);
        if (msg?.cmd === 'terminate') {
          terminated = true;
          getReporter()?.terminate();
        }
      } catch (e) {
        void e; // ignore a malformed control line
      }
    }
  };

  let buffer = '';
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        handleLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
  } catch (e) {
    void e; // a broken pipe reads as EOF for our purposes
  }
  if (buffer) handleLine(buffer);

  // EOF — soft-terminate per the header contract
  if (!terminated) getReporter()?.terminate();
  armWatchdog(graceTimeout, getExitCode);
};

export default listenControlChannel;
