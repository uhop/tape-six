#!/usr/bin/env node

import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {printVersion, printHelp, printFlagOptions} from '../src/utils/config.js';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp('tape6', 'Tape6 test runner (auto-detects runtime)', 'tape6 [options] [files...]', [
    ['--flags, -f <flags>', 'Set reporter flags (env: TAPE6_FLAGS)'],
    ['--par, -p <n>', 'Set parallelism level (env: TAPE6_PAR)'],
    ['--info', 'Show configuration info and exit'],
    ['--self', 'Print the path to this script and exit'],
    ['--help, -h', 'Show this help message and exit'],
    ['--version, -v', 'Show version and exit']
  ]);
  printFlagOptions();
  process.exit(0);
} else if (process.argv.includes('--version') || process.argv.includes('-v')) {
  printVersion('tape6');
  process.exit(0);
} else if (process.argv.includes('--self')) {
  const self = new URL(import.meta.url);
  if (self.protocol === 'file:') {
    console.log(fileURLToPath(self));
  } else {
    console.log(self);
  }
} else {
  if (typeof Deno == 'object' && Deno?.version) {
    await import('./tape6-deno.js');
  } else if (typeof Bun == 'object' && Bun?.version) {
    await import('./tape6-bun.js');
  } else if (typeof process == 'object' && process?.versions?.node) {
    await import('./tape6-node.js');
  } else {
    throw new Error('tape6 is not supported in this environment');
  }
}
