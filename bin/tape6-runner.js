#!/usr/bin/env node

import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {printVersion, printHelp} from '../src/utils/config.js';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp(
    'tape6-runner',
    'Print the path to a tape6 CLI script',
    'tape6-runner [options] [runtime]',
    [
      ['--help, -h', 'Show this help message and exit'],
      ['--version, -v', 'Show version and exit']
    ]
  );
  console.log('\nRuntimes: node, deno, bun, seq, server, runner, main (default)');
  process.exit(0);
}
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  printVersion('tape6-runner');
  process.exit(0);
}

const runtimeFiles = {
  node: 'tape6-node.js',
  deno: 'tape6-deno.js',
  bun: 'tape6-bun.js',
  seq: 'tape6-seq.js',
  server: 'tape6-server.js',
  runner: 'tape6-runner.js',
  main: 'tape6.js'
};
const requestedRuntime = runtimeFiles[process.argv[2]] || runtimeFiles.main;

const runtime = requestedRuntime,
  url = new URL('./' + runtime, import.meta.url),
  fileName = url.protocol === 'file:' ? fileURLToPath(url) : url.href;

console.log(fileName);
process.exit(typeof requestedRuntime == 'string' ? 0 : 1);
