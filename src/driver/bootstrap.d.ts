/**
 * The in-page half of the browser-worker contract: the strings and shapes a
 * driver (or the standalone web app) injects into a test page. Browser-safe —
 * pure string building, no platform imports.
 */

/** Test files a browser worker can run: `.js`, `.mjs`, `.htm`, `.html`. */
export const supportedTestFileRe: RegExp;

/** DOM id of the iframe hosting task `id`: `test-iframe-<id>`. */
export function iframeId(id: string): string;

/** The cooperative-drain message posted into a running test's iframe. */
export function terminateMessage(reason: string): {type: 'tape6-terminate'; reason: string};

/** URL (path + query) that loads an `.html` test file as a task. */
export function htmlTestUrl(fileName: string, options: {id: string; flags?: string}): string;

/**
 * Complete srcdoc HTML that runs a JS test file as a task: injects the
 * importmap, the `__tape6_id` / `__tape6_testFileName` / `__tape6_flags`
 * globals, and a module-script loader wired to `__tape6_error`.
 */
export function testPageSrcdoc(
  fileName: string,
  options: {id: string; flags?: string; importmap?: object | null}
): string;
