# Server harness — `withServer` / `startServer`

Design note for a tape6 utility that wraps the ephemeral-HTTP-server lifecycle used in test fixtures across the toolkit ecosystem. Status: **shipped in 1.8.0** — `src/server.js`, `src/server.d.ts`, `tests/test-server.js`, with `bin/tape6-server.js` migrated to use `startServer`. This document is preserved as the design rationale.

**Platform scope:** uses `node:http`, which is supported on Node, Bun, and Deno (all three CLI runtimes tape6 already targets). The existing `bin/tape6-server.js` runs on all three. Browsers are out of scope by design — running an HTTP server inside a webpage isn't a use case. So this is a single cross-runtime implementation, not an awkward adapter.

## Problem

Every `tape-six` consumer that tests HTTP behavior reimplements the same 10-line lifecycle:

```js
const server = http.createServer(handler);
server.listen(0);
await once(server, 'listening');
const {port} = server.address();
try {
  return await fn(`http://127.0.0.1:${port}`);
} finally {
  server.close();
  await once(server, 'close');
}
```

Found in: `dynamodb-toolkit`, `dynamodb-toolkit-koa`, `dynamodb-toolkit-express`, `dynamodb-toolkit-fetch`, `dynamodb-toolkit-lambda`, `install-artifact-from-github`. Six copies, slight drift in each (some race `'error'` vs `'listening'`, some don't; some pass `'127.0.0.1'` to `listen`, some rely on the default; some use `await new Promise(r => server.listen(0, r))`, others `await once(...)`). The drift is bug-shaped: tests on a port-busy CI machine hang on `await once(server, 'listening')` because no one listens for `'error'`.

## Survey — what each consumer actually wraps

| Consumer                       | Helper                                        | Server type                               | Distinctive bits                                         |
| ------------------------------ | --------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `dynamodb-toolkit`             | `withServer(handler, fn)`                     | `http.createServer(handler)`              | bare                                                     |
| `dynamodb-toolkit-koa`         | `withKoaServer(middleware, fn, {before})`     | `new Koa().use(middleware).listen(0)`     | `before(app)` hook for nested middleware                 |
| `dynamodb-toolkit-express`     | `withExpressServer(middleware, fn, {before})` | `express().use(middleware).listen(0)`     | same `before(app)` hook                                  |
| `dynamodb-toolkit-fetch`       | `withFetchHandler(handler, fn)`               | none — direct call                        | passes `(pathAndQuery, init) => Response`                |
| `dynamodb-toolkit-lambda`      | `withLambdaHandler(handler, fn)`              | none — synthetic Lambda event             | builds v1 / v2 / ALB shapes                              |
| `install-artifact-from-github` | `startMockServer({releaseHandler})`           | `http.createServer(...)` with route table | factory returns `{port, url, recorded, setAsset, close}` |

The fetch/lambda variants don't need a server — they call the handler directly. The koa/express variants need framework instantiation. The two `node:http` cases (`dynamodb-toolkit` and `install-artifact-from-github`) **are the same lifecycle** wrapping different handlers.

What tape6 should codify is the `node:http` lifecycle. Framework-specific harnesses (koa, express, fetch, lambda) compose on top of it where they want a server (koa, express) or stay separate where they don't (fetch, lambda).

## Proposed API

```js
// tape-six/server  (new module, exported via package.json#exports)

import http from 'node:http';
import {once} from 'node:events';

// --- procedural primitive ---

export const startServer = async (server, {host = '127.0.0.1', port = 0} = {}) => {
  // Race listening vs error — port-busy must reject, not hang.
  const listening = once(server, 'listening');
  const failure = once(server, 'error').then(([err]) => {
    throw err;
  });
  server.listen(port, host);
  await Promise.race([listening, failure]);
  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  const base = `http://${host}:${actualPort}`;

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    server.closeAllConnections?.(); // Node 18.2+; defeats keep-alive holds
    server.close();
    await once(server, 'close');
  };

  return {server, base, port: actualPort, host, close};
};

// --- callback-scoped wrapper (the 95% case) ---

export const withServer = async (serverHandler, clientHandler, opts) => {
  const server = http.createServer(serverHandler);
  const lifecycle = await startServer(server, opts);
  try {
    return await clientHandler(lifecycle.base, lifecycle);
  } finally {
    await lifecycle.close();
  }
};
```

### Signatures

```ts
export interface ServerLifecycle {
  server: http.Server;
  base: string; // e.g. "http://127.0.0.1:54321"
  port: number;
  host: string;
  close(): Promise<void>;
}

export interface ServerOptions {
  host?: string; // default "127.0.0.1"
  port?: number; // default 0 (OS-assigned)
}

export function startServer(server: http.Server, opts?: ServerOptions): Promise<ServerLifecycle>;

export function withServer<T>(
  serverHandler: http.RequestListener,
  clientHandler: (base: string, lifecycle: ServerLifecycle) => Promise<T> | T,
  opts?: ServerOptions
): Promise<T>;
```

### The two-role model

Conceptually `withServer` pairs two roles in a single test scope:

- **`serverHandler`** — function answering HTTP requests. Per-request callback: Node invokes it once for each incoming request. Either the SUT (a REST handler being tested directly) or a mock impersonating an external service.
- **`clientHandler`** — function running on the client side of the interaction while the server is up. Per-scope callback: invoked once per `withServer` call. Either drives requests itself (`fetch(base)`-style), or sets up a separate SUT that does (e.g., a spawned CLI given `${base}` as its endpoint env var). May also mix setup, requests, assertions, and side-effect inspection across multiple phases.

The shape is symmetric across both common flavors:

- **Server is the SUT** (`dynamodb-toolkit` REST tests): `serverHandler` is the code under test; `clientHandler` calls `fetch(base)` and asserts on responses.
- **Server is the mock** (`install-artifact-from-github`): `serverHandler` impersonates GitHub; `clientHandler` spawns the bin (the actual SUT) with `${base}` as `GITHUB_API_URL`, waits for it to exit, asserts on `recorded[]` requests, exit code, files written.

Naming reflects role on the wire (server side / client side), not which side is being tested. Either side can be the SUT.

### Why two functions, not one

`withServer` covers the common case: scoped resource, guaranteed cleanup, can't forget `close()`. `startServer` covers the cases `withServer` can't:

- Tests that span phases with intervening assertions and want to assert on `recorded` requests at multiple points.
- Tests sharing a server across nested `t.test()` blocks.
- Non-test code (e.g., `bin/tape6-server.js`) that wants a handle long-term.

Without `startServer`, those cases would either re-implement the lifecycle (defeating the whole point) or wrap their entire flow in `withServer` (awkward when "the flow" is the bin's main loop). Two exports, three lines of glue.

### Why it accepts `http.Server`, not `(handler)`

`withServer` accepts the handler because that's the 95% case. `startServer` accepts a fully-constructed server because:

- Koa / Express harnesses wrap `app.callback()` (Koa) or `app` itself (Express, callable as a request handler) in `http.createServer(...)` and pass the resulting server to `startServer`. Framework setup — `app.silent = true`, an optional `before(app)` hook, middleware mounting — is project-specific, so they typically keep a thin project-local wrapper that handles construction and delegates the lifecycle to `startServer`.
- `bin/tape6-server.js` already constructs the server with handlers attached for `'clientError'` etc. before it calls `listen`.
- Tests that need TLS, HTTP/2, or custom server options (`http.createServer({keepAliveTimeout: 0})`) can pass any server.

Accepting a constructed server is the more-general primitive. `withServer` is the convenience layer.

## Composing with `beforeAll` / `afterAll` / `beforeEach` / `afterEach`

tape6 provides the full hook set. `withServer` and `startServer` cover different lifetimes; hooks are how you reach the ones `withServer` alone can't.

**Lifetime 1 — server per test (no hooks):**

```js
test('GET / returns 200', t =>
  withServer(handler, async base => {
    const res = await fetch(`${base}/`);
    t.equal(res.status, 200);
  }));
```

`withServer` _is_ the per-test scoped resource. Don't reach for hooks when this fits.

**Lifetime 2 — server shared across a suite (`beforeAll` + `afterAll`):**

```js
let lifecycle;
beforeAll(async () => {
  lifecycle = await startServer(http.createServer(handler));
});
afterAll(() => lifecycle.close());

test('foo', async t => {
  const res = await fetch(`${lifecycle.base}/foo`);
  // ...
});
test('bar', async t => {
  const res = await fetch(`${lifecycle.base}/bar`);
  // ...
});
```

This is when a suite of tests share one server (expensive setup, or testing inter-request state). `startServer` is the procedural primitive; hooks own its lifetime.

**Lifetime 3 — shared server with per-test state reset (`beforeAll` + `afterAll` + `beforeEach`):**

The mock-server pattern: server stays up across many tests, but each test resets `recorded[]` (or asset map, or routing table). The handler closes over mutable state that the hooks reset.

```js
let lifecycle;
let recorded;
beforeAll(async () => {
  const handler = (req, res) => {
    recorded.push({method: req.method, url: req.url});
    res.writeHead(204).end();
  };
  lifecycle = await startServer(http.createServer(handler));
});
afterAll(() => lifecycle.close());
beforeEach(() => {
  recorded = [];
});

test('records one request per fetch', async t => {
  await fetch(`${lifecycle.base}/foo`);
  t.equal(recorded.length, 1);
});
```

This is what `install-artifact-from-github`'s mock-server pattern wants — the per-test recorder reset comes from `beforeEach`, the server lifecycle comes from `beforeAll`/`afterAll`.

**Anti-pattern — `beforeEach`/`afterEach` to start/close per test:** that's just `withServer` written across three function bodies. Use `withServer` instead unless something forces the split (rare).

### Third export: `setupServer` (the hook-registering helper)

Hooks come in pairs (`beforeAll`/`afterAll`). Forgetting `afterAll(close)` leaks the server across files; forgetting `beforeAll(start)` makes the lifecycle reference undefined when the first test runs. Both are silent-ish failure modes. Ship a single call that registers both:

```js
export const setupServer = (serverHandler, opts) => {
  let lifecycle = null;
  beforeAll(async () => {
    lifecycle = await startServer(http.createServer(serverHandler), opts);
  });
  afterAll(async () => {
    await lifecycle?.close();
    lifecycle = null;
  });
  return {
    get server() {
      return lifecycle?.server;
    },
    get base() {
      return lifecycle?.base;
    },
    get port() {
      return lifecycle?.port;
    },
    get host() {
      return lifecycle?.host;
    }
  };
};
```

**Live getters, not static snapshot.** The returned object reads `lifecycle` on each property access. If the user destructures (`const {base} = setupServer(...)`) at module load, `base` is `undefined` — a recoverable footgun. Property access at test time always sees the live state. We could `Object.freeze` to discourage mutation; not strictly necessary.

Usage:

```js
import {setupServer} from 'tape-six/server';

const server = setupServer(handler);

test('GET /foo returns 200', async t => {
  const res = await fetch(`${server.base}/foo`);
  t.equal(res.status, 200);
});

test('GET /bar returns 404', async t => {
  const res = await fetch(`${server.base}/bar`);
  t.equal(res.status, 404);
});
```

**State reset stays user-side.** The per-test reset pattern (`recorded = []` for mock-server scenarios) is project-specific — `setupServer` doesn't try to own it. Users compose `beforeEach` themselves:

```js
const server = setupServer((req, res) => {
  recorded.push({method: req.method, url: req.url});
  res.writeHead(204).end();
});
let recorded;
beforeEach(() => {
  recorded = [];
});
```

`setupServer` owns the suite lifecycle; user owns suite state. Clean separation.

**Why three exports, not two.** `withServer` for per-test, `setupServer` for suite-shared via hooks, `startServer` for everything else (multi-phase tests, non-test code like `bin/tape6-server`). Each maps to a distinct lifetime; collapsing them would force one shape to lie about its scope.

## Edge cases handled

### Listen errors (port busy, EACCES)

Existing helpers `await once(server, 'listening')` without racing `'error'`. On a port-busy CI machine, the test hangs until the test runner's overall timeout fires — confusing failure mode.

`startServer` races both events. If `'error'` fires first (EACCES, EADDRINUSE), the promise rejects with the original error. Caller sees the actual cause.

### Hanging `close()` from keep-alive

`fetch()` in Node 18+ uses an Undici connection pool with keep-alive. After the test body, `server.close()` waits for in-flight requests to drain — which it will — but the agent may hold the socket open under HTTP/1.1 keep-alive, and `close()` waits indefinitely for the socket to idle out (usually 5s timeout).

`server.closeAllConnections()` (Node 18.2+) drops them immediately. We call it inside `close()` so the test cleanup is immediate, not delayed by socket idle-timers. Optional-chained for older Node — the test still works, just slower.

### Caller's `fn` throws

`withServer`'s `try/finally` ensures `close()` runs whether `fn` resolves, rejects, or throws synchronously. If `close()` itself throws after `fn` rejected, the `fn` rejection is the one the caller sees (per JS try/finally semantics with already-thrown).

### Address object ambiguity

`server.address()` returns `string | AddressInfo | null`. For `listen(0, host)` it's always `AddressInfo`, but the type system requires the guard. We narrow with `typeof addr === 'object' && addr` before reading `addr.port`.

### IPv4 vs IPv6 default

We default `host` to `'127.0.0.1'` (IPv4), not `'localhost'`. On dual-stack systems `localhost` may resolve to `::1` first, and a server bound to `127.0.0.1` is unreachable from a fetch to `localhost` on macOS in some configs. Explicit `127.0.0.1` is the boring-and-works choice. Caller can override via `opts.host`.

## Synergy: dogfooding via `bin/tape6-server.js`

`bin/tape6-server.js:244-258` has its own listen / `'listening'` / `'error'` block (~25 lines including the `EACCES`/`EADDRINUSE` switch). After this lands, that becomes:

```js
import {startServer} from '../src/server.js';

try {
  const {base} = await startServer(server, {host, port});
  console.log(grey('Listening on ') + yellow(base) /* ... */);
} catch (error) {
  if (error.syscall === 'listen' && error.code === 'EACCES') {
    console.log(
      red('Error: ') + yellow(portToString(port)) + red(' requires elevated privileges') + '\n'
    );
    process.exitCode = 1;
    return;
  }
  if (error.syscall === 'listen' && error.code === 'EADDRINUSE') {
    console.log(red('Error: ') + yellow(portToString(port)) + red(' is already in use') + '\n');
    process.exitCode = 1;
    return;
  }
  throw error;
}
```

The bin keeps its bespoke error-formatting (it wants user-friendly EACCES/EADDRINUSE messages, not stack traces). `startServer` does the listen-vs-error race and returns the raw error; the bin's `catch` formats it. Net: ~25 lines down to ~15, and now `tape6-server` and the test harness share one tested lifecycle utility.

This is the right time to migrate `bin/tape6-server.js` to use `process.exitCode` per the existing dev-docs note (`replacing-process-exit.md`) — the early-exit on listen failure currently calls `process.exit(1)` which has the buffered-stdout truncation problem.

## Migration plan for downstream projects

After tape6 ships `tape-six/server`:

1. **`dynamodb-toolkit`** — `tests/helpers/withServer.js` becomes `export {withServer} from 'tape-six/server';`. One line.
2. **`dynamodb-toolkit-koa`** — `withKoaServer` becomes:

   ```js
   import {startServer} from 'tape-six/server';
   import http from 'node:http';
   import Koa from 'koa';

   export const withKoaServer = async (middleware, clientHandler, {before} = {}) => {
     const app = new Koa();
     app.silent = true;
     if (before) before(app);
     app.use(middleware);
     const server = http.createServer(app.callback());
     const lc = await startServer(server);
     try {
       return await clientHandler(lc.base);
     } finally {
       await lc.close();
     }
   };
   ```

   Drops to one `startServer` call; framework-specific bits stay in the project.

3. **`dynamodb-toolkit-express`** — same shape as koa.
4. **`dynamodb-toolkit-{fetch,lambda}`** — no change. They don't use a server.
5. **`install-artifact-from-github`** — `mock-server.js`'s lifecycle bit becomes `startServer(server)`. Route-matching, recording, asset staging stay project-local (those are Tier 2, not codified yet).

No flag day. Each project migrates on its own when it next touches the helper.

## What's NOT in scope

- **Declarative route table** (Tier 2) — `{'GET /foo': handler, 'POST /bar/*': handler}`. Every consumer wants slightly different things; deferred until a second consumer materializes.
- **Request recorder** — same reason. Single-consumer pattern (install-artifact's `recorded` array).
- **Koa/Express/Fetch/Lambda harnesses** — those compose `startServer` (or don't need it). They stay in their respective projects; tape6 doesn't take a Koa or Express dep.
- **HTTPS/HTTP/2** — caller passes a constructed server; if it's `https.createServer(...)`, `startServer` handles it. The `base` URL would still be `http://...` though — a follow-up needs to read the constructor and pick the scheme. Not in v1.
- **`Bun.serve()` / `Deno.serve()` runtime-native APIs** — different shapes from `node:http`. Don't need them: `node:http` already runs on Bun and Deno via their Node-API compatibility layers (which is how `bin/tape6-server.js` works on all three runtimes today). If a future consumer specifically wants the runtime-native API for a feature `node:http` doesn't expose, revisit then.

## What pairs naturally with this

The HTTP response assertion helpers already in `projects/tape6/queue.md` (`response.status`, `.headers`, `.body` shape via deep6 `match()`). They're consumer-side; this is server-side. Ship them in the same release — `withServer` is the test setup, response helpers are the assert.

## Open questions

1. **Module path:** `tape-six/server` (sibling of root `tape-six`) or `tape-six/test-server` (clearer about purpose)? Vote for `tape-six/server` — short, and "test" is implied by being in tape6.
2. **Re-export `http` types:** the `ServerLifecycle.server` field is `http.Server`. Caller already has the type from `node:http` — don't re-export from tape6.
3. **Should `withServer` accept a server too** (overload)? E.g. `withServer(http.Server, fn, opts)`. Maybe — it's a small ergonomic for cases where the caller wants `'clientError'` listeners attached before listen. Defer; add if asked for.
4. **Default `host`:** `'127.0.0.1'` per discussion above. Worth a one-line note in the JSDoc.
5. **Test of the test harness:** tape6's own `tests/test-server.js` exercises `withServer(handler, ...)` via `fetch` and validates port assignment, error propagation, `closeAllConnections` behavior. Plus a port-busy reproducer for the listen-error race.

## Surface impact

- New file: `src/server.js` (~80 lines — three exports: `startServer`, `withServer`, `setupServer`)
- New file: `src/server.d.ts` (~30 lines)
- `package.json#exports` — add `"./server": "./src/server.js"`
- `package.json#files` — already includes `src`, no change
- `bin/tape6-server.js` — refactor to use `startServer` (also migrate to `process.exitCode`)
- `tests/test-server.js` — new (covers all three exports + edge cases)
- `index.d.ts` — no change (server module is a separate import)
- `llms.txt` / `llms-full.txt` / wiki / `AGENTS.md` — document the new module
- Version bump: `1.7.14` → `1.8.0` (additive minor — new export, new bin behavior is internal)
