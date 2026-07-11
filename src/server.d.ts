import type {IncomingMessage, RequestListener, Server, ServerResponse} from 'node:http';

/**
 * Result of starting a server. Properties reflect the actual bound address
 * (e.g. `port` is the OS-assigned port when `0` was requested).
 */
export interface ServerLifecycle {
  /** The underlying `http.Server` instance. */
  server: Server;
  /** Base URL of the bound server, e.g. `"http://127.0.0.1:54321"`. */
  base: string;
  /** Actual port the server is listening on. */
  port: number;
  /** Host the server is bound to. */
  host: string;
  /**
   * Close the server. Idempotent. Calls `server.closeAllConnections()`
   * (when available) so keep-alive sockets don't delay teardown.
   */
  close(): Promise<void>;
}

/**
 * Options for `startServer` / `withServer` / `setupServer`.
 */
export interface ServerOptions {
  /**
   * Host to bind to. Defaults to `'127.0.0.1'` (explicit IPv4 — avoids
   * dual-stack ambiguity on macOS where `'localhost'` may resolve to `::1`).
   */
  host?: string;
  /** Port to bind to. Defaults to `0` (OS-assigned). */
  port?: number;
}

/**
 * Procedural primitive: start an `http.Server`, return a lifecycle handle.
 *
 * Races `'listening'` against `'error'` — port-busy / `EACCES` rejects,
 * never hangs.
 */
export function startServer(server: Server, opts?: ServerOptions): Promise<ServerLifecycle>;

/**
 * Scoped resource: spin up a server with `serverHandler`, run `clientHandler`
 * with the base URL, tear the server down in `finally`. Cleanup runs whether
 * `clientHandler` resolves, rejects, or throws synchronously.
 *
 * `serverHandler` is the per-request callback (Node calls it once per
 * incoming request). `clientHandler` is the per-scope test body (called once,
 * with the base URL). Either side may be the SUT — naming reflects role on
 * the wire, not which side is being tested.
 */
export function withServer<T>(
  serverHandler: RequestListener,
  clientHandler: (base: string, lifecycle: ServerLifecycle) => Promise<T> | T,
  opts?: ServerOptions
): Promise<T>;

/** One request captured by a `record()` listener. */
export interface RecordedRequest {
  method: string;
  url: string;
  /** Lower-cased header names (Node's normalization), copied to a plain object. */
  headers: Record<string, string | string[] | undefined>;
  /** The full request body, eagerly buffered as UTF-8 text (`''` when empty). */
  body: string;
}

/** A request listener that records every request it serves into `requests`. */
export type RecordingListener = RequestListener & {requests: RecordedRequest[]};

/**
 * Recording wrapper for the harness: returns a request listener that buffers
 * each incoming request into a `RecordedRequest` on its `requests` array,
 * then answers `204` — or delegates to `handler` when one is given.
 *
 * Eager by design: the body is fully drained before delegation, so `handler`
 * reads `entry.body` (its third argument) — never the already-consumed `req`
 * stream. Reset between tests with `rec.requests.length = 0`.
 */
export function record(
  handler?: (req: IncomingMessage, res: ServerResponse, entry: RecordedRequest) => void
): RecordingListener;

/**
 * Hook-registering helper for suite-shared servers. Registers `beforeAll` to
 * start the server and `afterAll` to close it; returns a live-getter context
 * whose properties reflect the running server's state at access time.
 *
 * Per-test state reset (e.g. clearing a `recorded[]` array) stays user-side:
 * compose your own `beforeEach`. `setupServer` owns the suite lifecycle; the
 * caller owns suite state.
 *
 * Don't destructure the returned object at module load time — its properties
 * read the live lifecycle on each access; destructuring captures stale
 * `undefined` values.
 */
export function setupServer(
  serverHandler: RequestListener,
  opts?: ServerOptions
): Readonly<{
  readonly server: Server | undefined;
  readonly base: string | undefined;
  readonly port: number | undefined;
  readonly host: string | undefined;
}>;
