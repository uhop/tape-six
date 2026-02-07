#!/usr/bin/env node

import process from 'node:process';
import {fileURLToPath} from 'node:url';

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
