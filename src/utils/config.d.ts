import type {OutputReporter} from '../test.js';

/** Print `<commandName> <version>` (version read from package.json). */
export const printVersion: (commandName: string) => void;

/** Print the standard `--help` header, usage line, and an aligned option table. */
export const printHelp: (
  commandName: string,
  description: string,
  usage: string,
  options?: [flag: string, description: string][]
) => void;

/** Print the flag legend (uppercase = on, lowercase = off). */
export const printFlagOptions: () => void;

/**
 * Expand wildcard patterns to files under `rootFolder`. A `!`-prefixed pattern
 * excludes matches accumulated so far — order matters. Returns paths relative
 * to `rootFolder`.
 */
export const resolvePatterns: (rootFolder: string, patterns: string[]) => Promise<string[]>;

/**
 * The `tape6.server` section — core-owned (`src/test-server.js` reads it);
 * declared so driver siblings read it cast-free. Still a user-authored bag,
 * hence the open index.
 */
export interface Tape6ServerConfig {
  protocol?: 'h1' | 'h2';
  plugins?: (string | {module: string; name?: string; prefix?: string})[];
  remotePlugins?: boolean;
  webAppPath?: string;
  cert?: string;
  key?: string;
  [key: string]: any;
}

/** The `tape6` config bag: test-set patterns keyed by environment, plus the importmap. */
export interface Tape6Config {
  tests?: string | string[];
  cli?: string | string[];
  browser?: string | string[];
  importmap?: {imports: Record<string, string>};
  server?: Tape6ServerConfig;
  [key: string]: any;
}

/** Read `tape6.json`, else `package.json#tape6`, else the default patterns. */
export const getConfig: (
  rootFolder: string,
  traceFn?: (msg: string) => void
) => Promise<Tape6Config>;

/** Resolve the file list for `type` (an environment-named test set + `cli` + `tests`). */
export const resolveTests: (
  rootFolder: string,
  type: string,
  traceFn?: (msg: string) => void
) => Promise<string[]>;

export type RuntimeName = 'node' | 'bun' | 'deno' | 'browser' | 'unknown';

/** The detected runtime and its env-var accessor (returns `undefined` in browsers). */
export const runtime: {name: RuntimeName; getEnvVar: (name: string) => string | undefined};

export type ReporterType = 'jsonl' | 'min' | 'tap' | 'tty';

export const reporterFileNames: Record<ReporterType, string>;

/** Reporter selected by `TAPE6_JSONL` / `TAPE6_MIN` / `TAPE6_TAP`; `null` in browsers. */
export const getReporterType: () => ReporterType | null;
export const getReporterFileName: (type?: ReporterType | null) => string;

export const DEFAULT_START_TIMEOUT: number;
export const DEFAULT_GRACE_TIMEOUT: number;

/** Per-worker startup budget (`TAPE6_WORKER_START_TIMEOUT`) in ms. */
export const getTimeoutValue: () => number;
/** Cooperative-drain window before force-kill (`TAPE6_GRACE_TIMEOUT`) in ms. */
export const getGraceTimeout: () => number;
/** Optional per-worker wall-clock budget (`TAPE6_WORKER_TIMEOUT`) in ms; 0 = off. */
export const getWorkerTimeout: () => number;

/** Single-letter flag → option name (`f` → `failureOnly`, ...). */
export const flagNames: Record<string, string>;

export interface ArgOption {
  aliases?: string[];
  initialValue?: string | null;
  isValueRequired?: boolean;
  /** Custom handler; mutate `flags` directly. */
  fn?: (flags: Record<string, any>, name: string, value: string) => void;
}

/** A bare function is shorthand for `{fn, isValueRequired: true}`. */
export type ArgOptions = Record<
  string,
  ArgOption | ((flags: Record<string, any>, name: string, value: string) => void)
>;

/** Parse CLI args into files + flag values. CLI-only: in a browser returns an empty array. */
export const processArgs: (argOptions: ArgOptions) => {
  files: string[];
  flags: Record<string, any>;
};

export interface RunnerFlags {
  /** The raw flag string, uppercase = on, lowercase = off. */
  flags: string;
  failureOnly?: boolean;
  showTime?: boolean;
  showBanner?: boolean;
  showData?: boolean;
  failOnce?: boolean;
  showStack?: boolean;
  showLog?: boolean;
  showAssertNumber?: boolean;
  monochrome?: boolean;
  useJsonL?: boolean;
  noConsoleCapture?: boolean;
  hideStreams?: boolean;
  /** Consumed by the parent (`EventServer`) only; children ignore them. */
  graceTimeout?: number;
  workerTimeout?: number;
  [key: string]: any;
}

export interface RunnerOptions {
  flags: RunnerFlags;
  parallel: number;
  files: string[];
  /** Raw parsed option values, keyed by canonical option name. */
  optionFlags: Record<string, any>;
}

/**
 * Parse standard runner options (`--flags` / `-f`, `--par` / `-p`, plus
 * `extraOptions`), fold in `TAPE6_*` env defaults, re-export `TAPE6_FLAGS`,
 * and resolve `parallel` to the available hardware when unset.
 */
export const getOptions: (extraOptions?: ArgOptions) => RunnerOptions;

/** Instantiate and install the environment-appropriate reporter if none is set. */
export const initReporter: (
  getReporter: () => OutputReporter | null,
  setReporter: (reporter: OutputReporter) => void,
  flags: RunnerFlags
) => Promise<void>;

/** Explicit `files` win; otherwise resolve the configured test sets for `type`. */
export const initFiles: (files: string[], rootFolder: string, type?: string) => Promise<string[]>;

/** Print the runtime / reporter / parallelism / flags / files banner. */
export const showInfo: (options: RunnerOptions, files?: string[] | null) => void;
