#!/usr/bin/env node

import process from 'node:process';
import {fileURLToPath} from 'node:url';

if (process.argv.includes('--self')) {
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
