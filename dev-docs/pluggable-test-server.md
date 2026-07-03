# tape6-server v2 — the pluggable test server

`tape6-server` is a pluggable fixture server with an embeddable programmatic core
(`createTestServer()`) and a switchable HTTP/2 mode. The bin is a thin CLI shell around
`src/test-server.js`. Design agreed 2026-07-02; primary consumer: `double-meh` integration
fixtures (streaming, SSE, cache backends), then browser testing via `tape-six-playwright`.

## Module layout

```
src/test-server.js            createTestServer() + withTestServer() (public entry, typed)
src/test-server/adapter.js    node req/res ⇄ WHATWG Request/Response bridge + iterable sugar
src/test-server/registry.js   PluginRegistry: normalization, longest-prefix routing, lifecycle
src/test-server/control.js    /--tests, /--patterns, /--importmap, /--plugins
src/test-server/statics.js    static file serving (GET/HEAD only), moved from the old bin
src/test-server/certs.js      TLS cert ladder for h2
src/test-server/trace.js      request trace logging + shared paint helpers
src/test-server/plugins/echo.js   the /--echo reference plugin
bin/tape6-server.js           CLI shell: args + env → createTestServer(), banner
```

## Plugin contract

A plugin module default-exports an async **factory**; the factory returns a handler record:

```js
export default async function fixtures(api, options) {
  // api: {rootFolder, config, base, protocol, log, trace}
  return {
    name: 'double-meh-fixtures',
    prefix: '/--io/', // claimed namespace, longest-prefix routing
    fetch(request, api) {}, // WHATWG Request → Response | (async) iterable | undefined
    close() {} // optional teardown: deregistration and server shutdown
  };
}
```

- **`fetch` is the paved road.** The adapter converts once at the boundary: request bodies are
  Web streams (`duplex: 'half'`), `Response` stream bodies are written chunk-by-chunk
  unbuffered, and client disconnect fires `request.signal` (SSE loops terminate).
- **Iterable sugar.** `fetch` may return an (async) iterable instead of a `Response`; a module
  may default-export a bare (async) generator function. Chunks: `Uint8Array` passes through,
  strings are UTF-8 encoded, other values are `JSON.stringify`-ed + `\n` (JSONL). Content type
  is inferred from the first chunk (objects → `application/x-ndjson`, else `text/plain`).
- **`raw(req, res, api)` escape hatch** for exotics; returning exactly `false` passes the
  request on, anything else means handled.
- **`undefined`/`null` from `fetch` passes** to the next plugin, ultimately to statics.

## Routing

1. Reserved control endpoints — `/--tests`, `/--patterns`, `/--importmap`, `/--plugins` —
   always first, non-overridable.
2. Plugins, longest `prefix` first (registration order breaks ties; prefixless plugins are
   offered everything). First `Response` wins; `undefined` passes.
3. Statics exactly as before (favicon, web-app redirect, files, `.html` fallback) — the
   GET/HEAD method gate lives here; plugins see all verbs.

Convention (not enforced): plugins mount under `/--<name>/`, continuing the control-namespace
style.

## Registration channels

- **Static:** `package.json` → `tape6.server.plugins` (array of module paths or
  `{module, options, name}`) + repeatable `--plugin` CLI flag.
- **Dynamic:** `PUT /--plugins` with `{module, options, name}`; `DELETE /--plugins/<name>`;
  `GET /--plugins` lists `{name, prefix, source}`. One namespace regardless of origin: PUT
  replaces by name (old instance's `close()` runs first — pleasant for watch-mode iteration;
  wire imports are cache-busted), DELETE removes even statically-configured plugins (they
  return on restart). Deregistration stops **new** routing; in-flight streams finish unless
  `close()` ends them — the server never force-kills sockets.
- **Containment instead of an IP guard:** wire-registered module specifiers resolve relative
  to `rootFolder` and must stay inside it — the endpoint mounts only code already in the
  project. Default **on** (remote-session workflows must keep working; the server exposes the
  rootFolder as static files anyway); `--no-remote-plugins` disables PUT/DELETE (GET stays).
- **In-process:** `createTestServer({plugins: [...]})` and `server.register(spec)` accept
  inline factories, records, bare handlers, and generator functions — unrestricted.

## Embeddable core

```js
const {base, close} = await createTestServer({rootFolder, plugins, port: 0});
```

Kernel-assigned ports make parallel test files collision-free by construction; each file owns
its server's lifecycle. `withTestServer(options, clientHandler)` is the scoped sibling.
Browser pages cannot start servers: browser tests use the shared origin that serves the page,
with fixtures from static config or a same-origin `PUT /--plugins` before the run. Spawning a
second server from a browser test is a non-goal (it would be cross-origin for zero benefit).

## State isolation convention

Stateful fixtures key their state by an explicit `scope` (query param or `X-Scope` header)
minted per test and sweep scopes by TTL. A documented convention for fixture authors, not
server machinery — it is what makes ETag/SSE-resume fixtures safe under parallel workers
against one shared server.

## Protocols

- `protocol: 'h1' | 'h2'` — config `tape6.server.protocol`, CLI `--h2`, env `TAPE6_PROTOCOL`.
  **h1 (cleartext) is the default**: h2 in browsers means TLS always, and self-signed TLS
  taxes manual debugging (interstitials) and service workers (refuse to register on cert-error
  origins) — multiplexing gains at localhost latencies don't pay for that.
- `h2` = `http2.createSecureServer({allowHTTP1: true})` with the compat API: the handler and
  every plugin are untouched; ALPN serves h2 and HTTP/1.1 on one HTTPS port. Node-only server
  mode (uneven `node:http2` support elsewhere); no h2c, no server push, no HTTP/3.
- **Why h2 exists:** browser `fetch()` request-body streaming (`duplex: 'half'`) is
  Chromium-only and h2/h3-only — the only way to browser-test double-meh's stream uploads;
  secondarily it lifts the ~6-connections-per-origin h1 cap for parallel SSE fixtures.
- **Cert ladder:** (1) `TAPE6_CERT`/`TAPE6_KEY` or config/option paths (mkcert route);
  (2) auto-generated self-signed via an `openssl` subprocess (EC P-256), cached under
  `node_modules/.cache/tape6/`, reused until expiry or SAN/host mismatch; (3) fail with a
  message naming both options.

## Platform notes

- Bun does not emit `'close'` on the server response when the client disconnects; the adapter
  also watches `req` `'aborted'` and the socket, so `request.signal` fires on all runtimes.
- The h1 server core (`node:http`) runs on Node, Bun, and Deno — embedding works on all three
  CLI runtimes; the full matrix covers it (`tests/cli/test-test-server.js`, h2:
  `tests/node/test-test-server-h2.js`).
