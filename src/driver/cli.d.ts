import {TestWorker as DriverTestWorker} from './TestWorker.js';
import {EventServerOptions, EventServerReporter} from '../utils/EventServer.js';

/**
 * Resolve the `--browsers` fan-out list against the singular `--browser`
 * fallback: splits, honors `"all"`, dedupes, validates. Returns either the
 * final list or the first unsupported name.
 */
export function resolveBrowsers(
  listValue: string | undefined,
  singular: string,
  supportedBrowsers: string[]
): {browsers: string[]; badBrowser?: undefined} | {browsers?: undefined; badBrowser: string};

/**
 * The whole driver-bin flow shared by `tape6-puppeteer` / `tape6-playwright`:
 * option/env parsing (`--server-url`, `--browser`/`--browsers`, `--flags`,
 * `--par`, `--start-server`, `--h2`, `--info`/`--self`/`--help`/`--version`),
 * config + protocol resolution, the `controlFetch` readiness probe,
 * `ensureServer` (self-launches this package's own `tape6-server`), the
 * per-engine run loop, and summary / exit-code handling.
 *
 * A driver bin reduces to one call:
 * `runDriverCli({packageUrl: import.meta.url, commandName, description, supportedBrowsers, TestWorker})`.
 * By convention the bin lives in `bin/` — the version is read from
 * `../package.json` relative to `packageUrl`.
 */
export function runDriverCli(config: {
  packageUrl: string;
  commandName: string;
  description: string;
  supportedBrowsers: string[];
  TestWorker: new (
    reporter: EventServerReporter,
    numberOfTasks?: number,
    options?: EventServerOptions
  ) => DriverTestWorker;
}): Promise<void>;

export default runDriverCli;
