import {promises as fsp} from 'node:fs';
import path from 'node:path';

import {listing, wildToRe} from './listing.js';
import {union, exclude} from './fileSets.js';

export const resolvePatterns = async (rootFolder, patterns) => {
  let result = [];
  for (const item of patterns) {
    if (item.length && item[0] == '!') {
      result = exclude(result, wildToRe(rootFolder, item.substring(1)));
    } else {
      result = union(result, await listing(rootFolder, item));
    }
  }
  return result.map(fileName => path.relative(rootFolder, fileName));
};

export const getConfig = async (rootFolder, traceFn) => {
  let cfg = null;

  // check tape6.json
  try {
    cfg = JSON.parse(await fsp.readFile(path.join(rootFolder, 'tape6.json')));
  } catch (error) {
    traceFn && traceFn('Cannot read tape6.json');
  }

  // check package.json, "tape6" section
  if (!cfg) {
    try {
      const pkg = JSON.parse(await fsp.readFile(path.join(rootFolder, 'package.json')));
      cfg = pkg.tape6;
    } catch (error) {
      traceFn && traceFn('Cannot read package.json');
    }
  }

  // check well-known files
  if (!cfg) cfg = {tests: ['/tests/test-*.*js']};

  return cfg;
};

export const resolveTests = async (rootFolder, type, traceFn) => {
  const cfg = await getConfig(rootFolder, traceFn);

  // determine test patterns
  let patterns = [];
  if (cfg[type]) {
    if (Array.isArray(cfg[type])) {
      patterns = patterns.concat(cfg[type]);
    } else if (typeof cfg[type] == 'string') {
      patterns.push(cfg[type]);
    }
  }

  if (Array.isArray(cfg.tests)) {
    patterns = patterns.concat(cfg.tests);
  } else if (typeof cfg.tests == 'string') {
    patterns.push(cfg.tests);
  }

  // resolve patterns
  return resolvePatterns(rootFolder, patterns);
};

export const runtime = {name: 'unknown', env: null};

if (typeof Deno == 'object' && Deno?.version) {
  runtime.name = 'deno';
  runtime.env = Deno.env;
} else if (typeof Bun == 'object' && Bun?.version) {
  runtime.name = 'bun';
  runtime.env = Bun.env;
} else if (typeof process == 'object' && process?.versions?.node) {
  runtime.name = 'node';
  runtime.env = process.env;
} else if (typeof window == 'object' && window?.document) {
  runtime.name = 'browser';
}

export const getEnv = (defaultEnv = null) => runtime.env || defaultEnv;

export const getReporter = () => {
  const env = getEnv();
  if (!env) return null;
  if (env.TAPE6_JSONL) return 'jsonl';
  if (env.TAPE6_TAP) return 'tap';
  return 'tty';
};
