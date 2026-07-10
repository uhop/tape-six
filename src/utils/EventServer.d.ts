/**
 * Teardown reason delivered to `destroyTask`:
 * - `'done'` — the task finished; tear its worker down now.
 * - `'failOnce'` — stop / bail-out: abort an in-flight task.
 * - `'timeout'` — the per-worker deadline (`workerTimeout`) fired.
 *
 * Any reason but `'done'` means: drain cooperatively (let cleanup run),
 * then force-kill after `graceTimeout` where the transport allows.
 */
export type DestroyReason = 'done' | 'failOnce' | 'timeout';

/**
 * A test event routed to the reporter — a loose bag (`type`, `test`,
 * `name`, `marker`, `operator`, `fail`, `data`, ...). See TESTING.md.
 */
export type TestEvent = {[key: string]: unknown};

/**
 * The reporter surface `EventServer` needs. Structural — every tape-six
 * reporter satisfies it.
 */
export interface EventServerReporter {
  report(event: TestEvent, suppressStopTest?: boolean): void;
  // no index signature: class-typed states (`State`) have none and must remain assignable
  state?: {stopTest?: boolean} | null;
}

/**
 * Options consumed by the base class. Runners pass their own keys through
 * (`flags`, `importmap`, `serverUrl`, `browser`, ...) — hence the index
 * signature; `any`, not `unknown`, so checked-JS siblings read pass-through
 * keys without casts (2026-07-10 decision, applies to all sidecar bags).
 */
export interface EventServerOptions {
  /**
   * Cooperative-drain window in ms before a force-kill (default: 5000).
   * CLI runners inject `TAPE6_GRACE_TIMEOUT` via `getOptions()`.
   */
  graceTimeout?: number;
  /**
   * Per-worker deadline in ms; unset or 0 disables it. CLI runners inject
   * `TAPE6_WORKER_TIMEOUT` via `getOptions()`.
   */
  workerTimeout?: number;
  [key: string]: any;
}

/**
 * Base class for test-worker drivers (the parallel/seq runners and the
 * `tape-six-proc` / `tape-six-puppeteer` / `tape-six-playwright` siblings).
 *
 * Two planes: DATA (worker → reporter — the `report()`/`close()`
 * event-ordering machinery) and CONTROL (reporter/runner → worker — a
 * single `terminate` delivered per transport by `destroyTask`). See
 * dev-docs/worker-control-channel.md.
 *
 * Subclasses implement the two transport hooks: `makeTask` and
 * `destroyTask`.
 */
export class EventServer {
  constructor(reporter: EventServerReporter, numberOfTasks?: number, options?: EventServerOptions);

  reporter: EventServerReporter;
  numberOfTasks: number;
  options: EventServerOptions;

  /** Drain window in ms before a force-kill; see `EventServerOptions.graceTimeout`. */
  graceTimeout: number;
  /** Per-worker deadline in ms; 0 = off; see `EventServerOptions.workerTimeout`. */
  workerTimeout: number;
  /**
   * Set on the first stop / bail-out signal; every in-flight task then gets
   * `destroyTask(id, 'failOnce')`. Tasks that finish starting later must
   * check it themselves (a just-created worker can miss the sweep).
   */
  stopRequested: boolean;

  /** Completion hook: called once when the last task closes. Assigned by runners. */
  done?: () => void;

  // DATA-plane bookkeeping — not a consumer surface.
  totalTasks: number;
  fileQueue: string[];
  passThroughId: string | null;
  retained: Record<string, TestEvent[]>;
  readyQueue: TestEvent[][];
  liveTasks: Set<string>;
  deadlineTimers: Record<string, ReturnType<typeof setTimeout>>;

  /** DATA plane: forward one worker event, preserving per-task ordering. */
  report(id: string, event: TestEvent): void;
  /**
   * DATA plane: a task's stream ended — release its retained events, start
   * the next queued file, and call `destroyTask(id, 'done')`.
   */
  close(id: string): void;

  /** Start a worker for `fileName` now if a slot is free, else queue it. */
  createTask(fileName: string): void;
  /** `createTask` every file. */
  execute(files: string[]): void;

  /**
   * Transport hook: start a worker for `fileName` and return its task id.
   * The base implementation is a no-op returning `undefined`.
   */
  makeTask(fileName: string): string | null | undefined;
  /**
   * Transport hook (CONTROL plane): deliver `terminate` to one worker.
   * The base implementation is a no-op; see `DestroyReason` for the
   * expected teardown semantics.
   */
  destroyTask(id: string, reason?: DestroyReason): void;
}

export default EventServer;
