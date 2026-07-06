import type {Test, Tester, TestOptions} from '../index.js';
import type {State, TestEvent} from './State.js';
import type {Deferred} from './utils/makeDeferred.js';

/**
 * The output-reporter surface `runTests` relies on: an event sink plus the
 * root `State` carrying suite-level hooks and the stop flag. Every shipped
 * reporter satisfies it.
 */
export interface OutputReporter {
  report(event: TestEvent): void;
  state: State;
  [key: string]: unknown;
}

/** `true` once a runner claimed this process (test files skip self-running then). */
export const getConfiguredFlag: () => boolean;
export const setConfiguredFlag: (value: unknown) => boolean;

/** Resolves with the runner module once `setTestRunner` announces it. */
export const testRunner: Promise<unknown>;
export const setTestRunner: (runner: unknown) => void;

/**
 * Ask to be called (once, deferred) when the first top-level test registers —
 * how runners learn a test file has content. Fires immediately if tests are
 * already queued.
 */
export const registerNotifyCallback: (callback: () => void) => void;
export const unregisterNotifyCallback: (callback: () => void) => boolean;

/** The active tester stack, innermost last. */
export const getTesters: () => Tester[];

/** The innermost currently-running tester, or `null` outside any test. */
export const getTester: () => Tester | null;

/** A queued top-level test: normalized options + the deferred resolved when it finishes. */
export interface QueuedTest {
  options: TestOptions;
  deferred?: Deferred<unknown>;
}

export const getTests: () => QueuedTest[];
export const clearTests: () => void;

export const getReporter: () => OutputReporter | null;
export const setReporter: (newReporter: OutputReporter) => OutputReporter;

export type Hook = () => void | Promise<void>;

export const getBeforeAll: () => Hook[];
export const clearBeforeAll: () => void;
export const getAfterAll: () => Hook[];
export const clearAfterAll: () => void;
export const getBeforeEach: () => Hook[];
export const clearBeforeEach: () => void;
export const getAfterEach: () => Hook[];
export const clearAfterEach: () => void;

/**
 * Run queued tests against the current reporter. Returns `false` when stopped
 * early (`failOnce` / bail-out), `true` otherwise. Runner-facing — test files
 * use `test()`.
 */
export const runTests: (tests: QueuedTest[]) => Promise<boolean>;

/**
 * Register a top-level test (delegates to the innermost tester when called
 * inside a running test). Carries `skip` / `todo` / `asPromise` and the hook
 * registrars as properties — see the `Test` interface.
 */
export const test: Test;

export const beforeAll: (fn: Hook) => void;
export const afterAll: (fn: Hook) => void;
export const beforeEach: (fn: Hook) => void;
export const afterEach: (fn: Hook) => void;

export {beforeAll as before, afterAll as after};

export default test;
