import type {Server as HttpServer, IncomingMessage, ServerResponse} from 'node:http';
import type {Http2SecureServer} from 'node:http2';

/** Wire protocol: HTTP/1.1 cleartext (default) or HTTPS with ALPN h2 + HTTP/1.1. */
export type Protocol = 'h1' | 'h2';

/**
 * Server-side context handed to plugin factories (first argument) and to
 * `fetch`/`raw` handlers (last argument).
 */
export interface PluginApi {
  /** Absolute root folder the server serves from. */
  rootFolder: string;
  /** The resolved `tape6` configuration object. */
  config: unknown;
  /** Base URL of the running server, e.g. `"http://127.0.0.1:54321"`. Empty until the server is listening. */
  base: string;
  /** The wire protocol the server speaks. */
  protocol: Protocol;
  /** Logger (defaults to `console.log`). */
  log: (...args: unknown[]) => void;
  /** Request trace logger; a no-op unless tracing is enabled. */
  trace: (status: number, req: IncomingMessage) => void;
}

/**
 * What a `fetch` handler may produce: a full `Response`, an (async) iterable
 * of chunks (strings/`Uint8Array`s pass through; other values are serialized
 * as JSONL), a bare string/`Uint8Array` body, or `undefined`/`null` to pass
 * the request to the next plugin (and ultimately the static file server).
 */
export type FetchResult =
  Response | AsyncIterable<unknown> | Iterable<unknown> | string | Uint8Array | undefined | null;

/** The paved-road plugin handler: WHATWG `Request` in, `FetchResult` out. */
export type FetchHandler = (request: Request, api: PluginApi) => FetchResult | Promise<FetchResult>;

/**
 * Escape-hatch handler on raw Node request/response objects. Returning
 * exactly `false` passes the request on; any other return value (including
 * `undefined`) means the request was handled.
 */
export type RawHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  api: PluginApi
) => unknown | Promise<unknown>;

/**
 * A mounted plugin: `fetch` is the paved road, `raw` the escape hatch for
 * exotics; `close` runs on deregistration and server shutdown.
 */
export interface PluginHandlerRecord {
  /** Registry key; derived from the module/function name when omitted. */
  name?: string;
  /**
   * Claimed URL namespace, longest-prefix routed (convention: `/--<name>/`).
   * A plugin without a prefix is offered every request.
   */
  prefix?: string;
  fetch?: FetchHandler;
  raw?: RawHandler;
  close?(): void | Promise<void>;
}

/**
 * The canonical plugin module shape: an async factory receiving the server
 * api and the registration options, returning a handler record.
 */
export type PluginFactory = (
  api: PluginApi,
  options?: unknown
) => PluginHandlerRecord | Promise<PluginHandlerRecord>;

/**
 * Anything accepted by `plugins: []`, `register()`, and `PUT /--plugins`:
 * a module path (resolved against `rootFolder`), a `{module, options, name}`
 * descriptor, or — in-process only — an inline factory, handler record,
 * bare handler, or (async) generator function.
 */
export type PluginSpec =
  | string
  | {module: string; options?: unknown; name?: string}
  | PluginFactory
  | PluginHandlerRecord
  | FetchHandler;

/** A registry listing entry, as returned by `plugins()` and `GET /--plugins`. */
export interface PluginInfo {
  name: string;
  prefix: string;
  source: 'static' | 'dynamic';
}

export interface TestServerOptions {
  /** Root folder to serve from. Defaults to the current working directory. */
  rootFolder?: string;
  /** Path to the web app directory, relative to `rootFolder`. Defaults to the bundled web app. */
  webAppPath?: string;
  /** Plugins to mount at startup, merged after `tape6.server.plugins` from the config. */
  plugins?: PluginSpec[];
  /** Wire protocol. `'h2'` is Node-only. Defaults to `tape6.server.protocol` or `'h1'`. */
  protocol?: Protocol;
  /** Host to bind to. Defaults to `'127.0.0.1'`. */
  host?: string;
  /** Port to bind to. Defaults to `0` (OS-assigned) — the embeddable, collision-free mode. */
  port?: number | string;
  /** Path to a TLS certificate (h2). Falls back to `TAPE6_CERT`, then an auto-generated self-signed cert. */
  cert?: string;
  /** Path to the TLS private key (h2). Falls back to `TAPE6_KEY`. */
  key?: string;
  /** Set to `false` to reject `PUT`/`DELETE` on `/--plugins`. Default: `true`. */
  remotePlugins?: boolean;
  /** Enable request trace logging. Default: `false`. */
  trace?: boolean;
  /** Force colors on/off for trace output. Defaults to TTY detection. */
  hasColors?: boolean;
  /** Logger used for tracing and diagnostics. Defaults to `console.log`. */
  log?: (...args: unknown[]) => void;
}

/** A running test server. */
export interface TestServer {
  server: HttpServer | Http2SecureServer;
  protocol: Protocol;
  /** Base URL, e.g. `"http://127.0.0.1:54321"`. */
  base: string;
  host: string;
  port: number;
  /** The resolved `tape6` configuration object. */
  config: unknown;
  /** Mount a plugin at runtime. In-process specs are unrestricted. */
  register(spec: PluginSpec): Promise<PluginInfo>;
  /** Unmount a plugin by name; resolves `false` for an unknown name. */
  deregister(name: string): Promise<boolean>;
  /** List mounted plugins. */
  plugins(): PluginInfo[];
  /** Close every plugin, terminate connections, and stop the server. Idempotent. */
  close(): Promise<void>;
}

/**
 * Create an embeddable test server: control endpoints (`/--tests`,
 * `/--patterns`, `/--importmap`, `/--plugins`), mounted plugins by longest
 * prefix, then static files (GET/HEAD only). With `port: 0` parallel test
 * files get collision-free servers by construction.
 */
export function createTestServer(options?: TestServerOptions): Promise<TestServer>;

/**
 * Scoped wrapper: create a test server, run `clientHandler` with its base
 * URL, close the server in `finally`.
 */
export function withTestServer<T>(
  options: TestServerOptions,
  clientHandler: (base: string, server: TestServer) => T | Promise<T>
): Promise<T>;
