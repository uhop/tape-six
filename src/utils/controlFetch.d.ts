/**
 * Control-plane client for the tape6 test server's endpoints (`/--tests`,
 * `/--patterns`, `/--importmap`). Owned by tape-six core: the endpoints and
 * the cert-cache location (`node_modules/.cache/tape6/cert.pem`, written by
 * `src/test-server/certs.js`) are core's contract — browser providers import
 * this client instead of hand-mirroring it.
 */

/** `true` when a TLS request read a plaintext answer — an h1 server behind an `https:` URL. */
export const isProtocolMismatch: (error: unknown) => boolean;

/**
 * The response surface the control client guarantees — the common subset of
 * global `fetch`'s `Response` and the scoped-TLS path's shim.
 */
export interface ControlResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
}

/**
 * Build a control fetch rooted at `rootFolder` (defaults to `process.cwd()`).
 *
 * Every request carries a 3s hard deadline (a dying listener can accept and
 * never answer); timeouts surface as errors with `code: 'ETIMEDOUT'` and are
 * never retried on a lower trust rung. `http:` URLs go through global `fetch`;
 * `https:` goes through `node:https` so TLS trust stays scoped to control
 * requests — never process-wide — walking the ladder: `TAPE6_CERT` pinned as
 * CA (failures stay loud, no fallback), else the server's cached self-signed
 * cert, else relaxed verification. The first successful rung is cached for
 * the fetch's lifetime.
 */
export const createControlFetch: (rootFolder?: string) => (url: string) => Promise<ControlResponse>;
