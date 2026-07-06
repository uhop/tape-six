import type {Timer} from './utils/timer.js';

/** Marker property stamped on tape-six-owned errors and serialized specials. */
export const signature: string;

/** Thrown to unwind a test when `failOnce` or a bail-out fires. Detect with `isStopTest`. */
export class StopTest extends Error {
  constructor(...args: ConstructorParameters<typeof Error>);
}

/**
 * `true` for `StopTest` instances, including cross-realm copies revived from
 * serialized events (matched structurally via the `signature` marker).
 */
export const isStopTest: (error: unknown) => boolean;

/** Structural check for `node:assert`-style `AssertionError` objects (any realm). */
export const isAssertionError: (error: unknown) => boolean;

/** Extract the `at ...` frames of an error stack as trimmed strings. */
export const getStackList: (error: {stack: string}) => string[];

/** A test event routed through the reporter pipeline — a loose bag. See TESTING.md. */
export type TestEvent = {[key: string]: unknown};

export type Hook = () => void | Promise<void>;

export interface StateOptions {
  name?: string;
  test?: number;
  time?: number;
  skip?: boolean;
  todo?: boolean;
  failOnce?: boolean;
  timer?: Timer;
}

/**
 * Per-test bookkeeping node: assert/skip/fail counters, inherited flags
 * (`skip`, `todo`, `failOnce`), hook queues, and the abort controller backing
 * `t.signal`. States chain via `parent`; iterating a state walks that chain
 * from the innermost out.
 */
export class State {
  constructor(parent: State | null | undefined, options: StateOptions);

  parent: State | null | undefined;
  name: string;
  test: number;
  skip: boolean | undefined;
  todo: boolean | undefined;
  failOnce: boolean | undefined;
  /** The parent's assert count at creation — offsets this state's assert ids. */
  offset: number;
  asserts: number;
  skipped: number;
  failed: number;
  /** Direct assertions in this state only — `t.plan()`'s comparison basis. */
  localAsserts: number;
  stopTest: boolean;
  timer: Timer;
  startTime: number;
  time: number;
  abortController: AbortController;

  beforeAll: Hook[];
  afterAll: Hook[];
  beforeEach: Hook[];
  afterEach: Hook[];
  isBeforeAllUsed: boolean;

  /** Aborted when the test ends — backs `t.signal`. */
  get signal(): AbortSignal;
  abort(): void;
  dispose(): void;

  /** Roll this state's counters up into the parent. */
  updateParent(): void;

  runBeforeAll(): Promise<void>;
  runAfterAll(): Promise<void>;
  runBeforeEach(): Promise<void>;
  runAfterEach(): Promise<void>;

  /** Normalize an event: counters, ids, timing, stack extraction, stop propagation. */
  preprocess(event: TestEvent): TestEvent;
  /** Throws `StopTest` when the (pre-processed) event demands a stop, unless suppressed. */
  postprocess(event: TestEvent, suppressStopTest?: boolean): void;

  /** Walk this state and its ancestors, innermost first. */
  [Symbol.iterator](): IterableIterator<State>;
}

export default State;
