import test from '../index.js';
import type {RunnerOptions, Tape6Config} from '../src/utils/config.js';

// pass-through keys read without casts in checked JS (2026-07-10: bags are `any`)
const checkConfigBag = (config: Tape6Config): string | undefined => config.server?.protocol;
const checkOptionFlags = (options: RunnerOptions): string => options.optionFlags.serverUrl;
const checkRunnerFlags = (options: RunnerOptions): string => options.flags.serverUrl;

test('config sidecar bags are open for pass-through reads (compile-time check)', t => {
  t.pass();
});
