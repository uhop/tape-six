import {promises as fsp} from 'node:fs';
import path from 'node:path';

import {listing, wildToRe} from './listing.js';
import {union, exclude} from '../utils/fileSets.js';

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
    if (Array.isArray(cfg[type].tests)) {
      patterns = patterns.concat(cfg[type].tests);
    } else if (typeof cfg[type].tests == 'string') {
      patterns.push(cfg[type].tests);
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
