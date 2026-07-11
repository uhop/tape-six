import test from '../index.js';
import type {RunnerOptions, Tape6Config, Tape6ServerConfig} from '../src/utils/config.js';

// pass-through keys read without casts in checked JS (2026-07-10: bags are `any`)
const checkConfigBag = (config: Tape6Config): string | undefined => config.server?.protocol;

// the core-owned `tape6.server` section is declared — driver bins read it typed, cast-free
const checkServerSection = (config: Tape6Config): Tape6ServerConfig | undefined => config.server;
const checkServerProtocol = (config: Tape6Config): 'h1' | 'h2' | undefined =>
  config.server?.protocol;
const checkOptionFlags = (options: RunnerOptions): string => options.optionFlags.serverUrl;
const checkRunnerFlags = (options: RunnerOptions): string => options.flags.serverUrl;

test('config sidecar bags are open for pass-through reads (compile-time check)', t => {
  t.pass();
});
