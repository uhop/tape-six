import type {IncomingMessage} from 'node:http';

/**
 * Anything `asText` / `asJson` / `asBytes` / `header` / `headers` accept.
 * Either a W3C `Response` (from `fetch`) or a Node `http.IncomingMessage`.
 */
export type ResponseLike = Response | IncomingMessage;

/**
 * Read the response body as a UTF-8 string. Works with both `Response`
 * (delegates to `res.text()`) and `http.IncomingMessage` (drains the
 * stream and decodes).
 */
export function asText(res: ResponseLike): Promise<string>;

/**
 * Read the response body and parse as JSON. Equivalent to
 * `JSON.parse(await asText(res))`; uses `res.json()` directly when
 * available.
 */
export function asJson<T = unknown>(res: ResponseLike): Promise<T>;

/**
 * Read the response body as raw bytes (`Uint8Array`). For
 * `http.IncomingMessage`, drains the stream; for `Response`, delegates
 * to `arrayBuffer()`.
 */
export function asBytes(res: ResponseLike): Promise<Uint8Array>;

/**
 * Read a single response header by name (case-insensitive). Returns
 * `null` if the header isn't present (matching `Response.headers.get`
 * semantics). For `http.IncomingMessage` headers that are arrays
 * (e.g. `set-cookie`), values are joined with `, `.
 */
export function header(res: ResponseLike, name: string): string | null;

/**
 * Return all response headers as a plain object with lowercase keys.
 * Array-valued headers (e.g. `set-cookie` on `IncomingMessage`) are
 * joined with `, ` to match `Response.headers` shape.
 */
export function headers(res: ResponseLike): Record<string, string>;
