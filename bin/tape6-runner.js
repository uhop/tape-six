#!/usr/bin/env node

import process from 'node:process';
import {fileURLToPath} from 'node:url';

const requestedRuntime =
  {
    node: 'tape6-node.js',
    deno: 'tape6-deno.js',
    bun: 'tape6-bun.js',
    server: 'tape6-server.js',
    runner: 'tape6-runner.js',
    main: 'tape6.js'
  }[process.argv[2]];

const runtime = requestedRuntime || 'tape6.js',
  url = new URL('./' + runtime, import.meta.url),
  fileName = url.protocol === 'file:' ? fileURLToPath(url) : url.href;

console.log(fileName);
process.exit(typeof requestedRuntime == 'string' ? 0 : 1);
