import {promises as fsp, readFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

import {listing, wildToRe} from './listing.js';

export const printVersion = commandName => {
  const pkgJsonPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../package.json'
    ),
    version = JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version;
  console.log(commandName + ' ' + version);
};

export const printHelp = (commandName, description, usage, options) => {
  const pkgJsonPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../package.json'
    ),
    version = JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version;
  console.log(commandName + ' ' + version + ' \u2014 ' + description + '\n');
  console.log('Usage: ' + usage + '\n');
  if (options) {
    console.log('Options:');
    const width = options.reduce((max, [flag]) => Math.max(max, flag.length), 0) + 2;
    for (const [flag, desc] of options) {
      console.log('  ' + flag.padEnd(width) + desc);
    }
  }
};

const flagDescriptions = {
  f: 'Show failed tests only',
  t: 'Show test execution time',
  b: 'Show the banner',
  d: 'Show test data',
  o: 'Stop after first failure',
  s: 'Show stack traces',
  l: 'Show console log output',
  n: 'Show assertion numbers',
  m: 'Disable colors (monochrome)',
  j: 'Use JSONL reporter',
  c: 'Disable console capture',
  h: 'Hide streams'
};

export const printFlagOptions = () => {
  console.log('\nFlags (uppercase = on, lowercase = off):');
  for (const [flag, desc] of Object.entries(flagDescriptions)) {
    console.log('  ' + flag.toUpperCase() + '  ' + desc);
  }
};

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
      for await (const file of listing(rootFolder, item)) {
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

export const reporterFileNames = {
  jsonl: 'JSONLReporter.js',
  min: 'MinReporter.js',
  tap: 'TapReporter.js',
  tty: 'TTYReporter.js'
};

export const getReporterType = () => {
  if (runtime.name === 'browser') return null;
  if (runtime.getEnvVar('TAPE6_JSONL')) return 'jsonl';
  if (runtime.getEnvVar('TAPE6_MIN')) return 'min';
  if (runtime.getEnvVar('TAPE6_TAP')) return 'tap';
  return 'tty';
};

export const getReporterFileName = type => {
  const reporterType = type || getReporterType();
  return reporterFileNames[reporterType] || reporterFileNames.tty;
};

export const DEFAULT_START_TIMEOUT = 5_000;

export const getTimeoutValue = () => {
  if (runtime.name === 'browser') return DEFAULT_START_TIMEOUT;
  const timeoutValue = runtime.getEnvVar('TAPE6_WORKER_START_TIMEOUT');
  if (!timeoutValue) return DEFAULT_START_TIMEOUT;
  let timeout = Number(timeoutValue);
  if (isNaN(timeout) || timeout <= 0 || timeout === Infinity) timeout = DEFAULT_START_TIMEOUT;
  return timeout;
};

// parsing options

export const flagNames = {
  f: 'failureOnly',
  t: 'showTime',
  b: 'showBanner',
  d: 'showData',
  o: 'failOnce',
  s: 'showStack',
  l: 'showLog',
  n: 'showAssertNumber',
  m: 'monochrome',
  j: 'useJsonL',
  c: 'noConsoleCapture',
  h: 'hideStreams'
};

export const processArgs = argOptions => {
  const result = {files: [], flags: {}};
  let args = [];
  switch (runtime.name) {
    case 'browser':
      return [];
    case 'deno':
      args = Deno.args;
      break;
    case 'bun':
      args = Bun.argv.slice(2);
      break;
    case 'node':
      args = process.argv.slice(2);
      break;
  }

  const argNames = {};
  for (const argName of Object.keys(argOptions)) {
    let option = argOptions[argName];
    if (typeof option == 'function') {
      option = {fn: option, isValueRequired: true};
    } else {
      option = {...option};
    }
    option.canonicalName = argName;
    argNames[argName] = option;
    if (Array.isArray(option?.aliases)) {
      for (const alias of option.aliases) {
        argNames[alias] = option;
      }
    }
    result.flags[argName] = option?.initialValue ?? null;
  }

  for (let i = 0; i < args.length; ++i) {
    const arg = args[i],
      [name, ...values] = arg.split('=');
    let opt = argNames[name],
      value = values.join('=');

    if (!opt) {
      result.files.push(arg);
      continue;
    }

    if (opt.isValueRequired && !values.length) {
      if (++i < args.length) {
        value = args[i];
      } else {
        value = '';
      }
    }

    if (typeof opt.fn == 'function') {
      opt.fn(result.flags, name, value);
    } else {
      result.flags[opt.canonicalName] = value;
    }
  }

  return result;
};

export const getOptions = extraOptions => {
  const args = processArgs({
    '--flags': {
      aliases: ['-f'],
      initialValue: runtime.getEnvVar('TAPE6_FLAGS') || '',
      isValueRequired: true,
      fn: (flags, _, value) => {
        flags['--flags'] += value;
      }
    },
    '--par': {
      aliases: ['-p'],
      initialValue: runtime.getEnvVar('TAPE6_PAR') || '',
      isValueRequired: true
    },
    ...extraOptions
  });

  const flags = args.flags['--flags'],
    options = {flags: {flags}, parallel: 1, files: args.files, optionFlags: args.flags};

  // set back flags
  if (runtime.name === 'deno') {
    Deno.env.set('TAPE6_FLAGS', flags);
  } else if (runtime.name === 'bun') {
    Bun.env.TAPE6_FLAGS = flags;
  } else {
    process.env.TAPE6_FLAGS = flags;
  }

  for (let i = 0; i < flags.length; ++i) {
    const flag = flags[i].toLowerCase(),
      name = flagNames[flag];
    if (typeof name == 'string') options.flags[name] = flag !== flags[i];
  }

  let parallel = args.flags['--par'];

  if (parallel) {
    parallel = Math.max(0, +parallel);
    if (isNaN(parallel) || parallel === Infinity) parallel = 0;
  } else {
    parallel = 0;
  }

  if (!parallel) {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      parallel = navigator.hardwareConcurrency;
    } else {
      try {
        parallel = os.availableParallelism();
      } catch (e) {
        void e;
        parallel = 1;
      }
    }
  }
  options.parallel = parallel;

  return options;
};

export const initReporter = async (getReporter, setReporter, flags) => {
  const currentReporter = getReporter();
  if (!currentReporter) {
    const reporterType = getReporterType(),
      reporterFile = getReporterFileName(reporterType),
      CustomReporter = (await import('../reporters/' + reporterFile)).default,
      hasColors = !(
        flags.monochrome ||
        runtime.getEnvVar('NO_COLOR') ||
        runtime.getEnvVar('NODE_DISABLE_COLORS') ||
        runtime.getEnvVar('FORCE_COLOR') === '0'
      ),
      customOptions = reporterType === 'tap' ? {useJson: true, hasColors} : {...flags, hasColors},
      customReporter = new CustomReporter(customOptions);
    setReporter(customReporter);
  }
};

export const initFiles = (files, rootFolder, type) => {
  if (files.length) return resolvePatterns(rootFolder, files);
  return resolveTests(rootFolder, type || runtime.name);
};

export const showInfo = (options, files) => {
  const reporterType = getReporterType();
  console.log('Runtime: ', runtime.name);
  console.log('Reporter:', reporterType);
  console.log('Parallel:', options.parallel);

  const names = Object.keys(options.flags),
    width = names.reduce((max, name) => Math.max(max, name.length), 0) + 1;
  console.log('Flags:', options.flags.flags || '');
  for (let i = 0; i < names.length; ++i) {
    const name = names[i];
    if (name === 'flags') continue;
    console.log('  ' + (name + ':').padEnd(width), options.flags[name]);
  }

  if (files) {
    if (files.length) {
      console.log('Files (' + files.length + '):');
      for (const file of files) {
        console.log('  /' + file);
      }
    } else {
      console.log('Files: none');
    }
  }
};
