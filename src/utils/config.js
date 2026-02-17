import {promises as fsp} from 'node:fs';
import path from 'node:path';

import {listing, wildToRe} from './listing.js';

const exclude = (files, pattern) => {
  const excluded = new Set();
  for (const file of files) {
    if (pattern.test(file)) excluded.add(file);
  }
  return files.difference(excluded);
};

export const resolvePatterns = async (rootFolder, patterns) => {
  let result = new Set();
  for (const item of patterns) {
    if (item.length && item[0] == '!') {
      result = exclude(result, wildToRe(rootFolder, item.substring(1)));
    } else {
      for (const file of await listing(rootFolder, item)) {
        result.add(file);
      }
    }
  }

  const files = [];
  for (const file of result) {
    files.push(path.relative(rootFolder, file));
  }
  return files;
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
  if (!cfg) cfg = {tests: ['/tests/test-*.js', '/tests/test-*.mjs'], cli: ['/tests/test-*.cjs']};

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

  if (type !== 'browser') {
    if (Array.isArray(cfg.cli)) {
      patterns = patterns.concat(cfg.cli);
    } else if (typeof cfg.cli == 'string') {
      patterns.push(cfg.cli);
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

export const runtime = {name: 'unknown', getEnvVar: () => undefined};

if (typeof Deno == 'object' && Deno?.version) {
  runtime.name = 'deno';
  runtime.getEnvVar = name => Deno.env.get(name);
} else if (typeof Bun == 'object' && Bun?.version) {
  runtime.name = 'bun';
  runtime.getEnvVar = name => Bun.env[name];
} else if (typeof process == 'object' && process?.versions?.node) {
  runtime.name = 'node';
  runtime.getEnvVar = name => process.env[name];
} else if (typeof window == 'object' && window?.document) {
  runtime.name = 'browser';
}

export const getReporterType = () => {
  if (runtime.name === 'browser') return null;
  if (runtime.getEnvVar('TAPE6_JSONL')) return 'jsonl';
  if (runtime.getEnvVar('TAPE6_TAP')) return 'tap';
  return 'tty';
};
