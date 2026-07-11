import EventServer, {EventServerOptions, EventServerReporter} from '../utils/EventServer.js';

/**
 * Base class for driver-backed browser workers (`tape-six-puppeteer`,
 * `tape-six-playwright`): owns the whole shared task lifecycle — per-task
 * BrowserContext + Page with completion driven by the page `close` event, the
 * `__tape6_reporter` / `__tape6_error` wiring, iframe injection via
 * `driver/bootstrap`, cooperative drain (`tape6-terminate`) with a
 * `graceTimeout` force-kill, and cleanup.
 *
 * Subclasses supply the four driver-adapter members below. Driver handles
 * (browser, context, page) are `any` — they belong to the driver's API, not
 * to this contract. The base standardizes on the single-object
 * `page.evaluate(fn, arg)` convention, which both Puppeteer and Playwright
 * accept.
 */
export class TestWorker extends EventServer {
  constructor(reporter: EventServerReporter, numberOfTasks?: number, options?: EventServerOptions);

  /** Engines this driver can launch; index 0 is the default. Adapter member. */
  readonly supportedBrowsers: string[];
  /** The driver's page-level error event: `'error'` (Puppeteer) or `'pageerror'` (Playwright). Adapter member. */
  readonly pageErrorEvent: string;
  /**
   * Launch the named engine and return the driver's browser handle. Owns
   * driver-specific launch options and the install-remediation error message.
   * Adapter member.
   */
  launchBrowser(name: string, options: {insecure: boolean}): Promise<any>;
  /**
   * Create an isolated browsing context on the launched browser. `insecure`
   * asks to accept the tape6 self-signed certificate (h2 mode) wherever the
   * driver takes that flag. Adapter member.
   */
  newContext(browser: any, options: {insecure: boolean}): Promise<any>;

  /** `true` when `options.serverUrl` is `https:` — the h2 / TLS mode. */
  readonly insecure: boolean;

  /** The launched driver browser handle, `null` before launch / after cleanup. */
  browser: any;

  makeTask(fileName: string): string;
  destroyTask(id: string, reason?: string): void;
  cleanup(): Promise<void>;
}

export default TestWorker;
