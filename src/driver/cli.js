// @ts-self-types="./cli.d.ts"

import {readFileSync} from 'node:fs';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

import {
  getOptions,
  getConfig,
  initReporter,
  showInfo,
  printFlagOptions,
  runtime
} from '../utils/config.js';
import {getReporter, setReporter} from '../test.js';
import {selectTimer} from '../utils/timer.js';
import {createControlFetch, isProtocolMismatch} from '../utils/controlFetch.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getServerUrl = () => {
  if (process.env.TAPE6_SERVER_URL) return process.env.TAPE6_SERVER_URL;
  const host = process.env.HOST || 'localhost',
    port = process.env.PORT || '3000';
  return `http://${host}:${port}`;
};

// --browsers (fan-out) overrides --browser; the singular value is the
// one-element fallback, so a single validation covers both paths
export const resolveBrowsers = (listValue, singular, supportedBrowsers) => {
  let browsers = String(listValue || '')
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);
  if (browsers.includes('all')) browsers = [...supportedBrowsers];
  browsers = [...new Set(browsers)];
  if (!browsers.length) browsers = [singular];
  const badBrowser = browsers.find(name => !supportedBrowsers.includes(name));
  return badBrowser === undefined ? {browsers} : {badBrowser};
};

export const runDriverCli = async ({
  packageUrl,
  commandName,
  description,
  supportedBrowsers,
  TestWorker
}) => {
  const rootFolder = process.cwd();
  const controlFetch = createControlFetch(rootFolder);

  const getVersion = () => {
    // by convention the caller is bin/<commandName>.js — package.json is one up
    const pkgPath = fileURLToPath(new URL('../package.json', packageUrl));
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  };

  const showSelf = () => {
    const self = new URL(packageUrl);
    if (self.protocol === 'file:') {
      console.log(fileURLToPath(self));
    } else {
      console.log(self);
    }
    process.exit(0);
  };

  const showVersion = () => {
    console.log(commandName + ' ' + getVersion());
    process.exit(0);
  };

  const showHelp = () => {
    console.log(commandName + ' ' + getVersion() + ' — ' + description + '\n');
    console.log('Usage: ' + commandName + ' [options] [patterns...]\n');
    const options = [
      ['--flags, -f <flags>', 'Set reporter flags (env: TAPE6_FLAGS)'],
      ['--par, -p <n>', 'Set parallelism level (env: TAPE6_PAR)'],
      [
        '--browser, -b <name>',
        `Browser engine: ${supportedBrowsers.join('|')} (env: TAPE6_BROWSER, default: ${supportedBrowsers[0]})`
      ],
      [
        '--browsers <list>',
        'Run several engines: comma-separated or "all" (env: TAPE6_BROWSERS; overrides --browser)'
      ],
      [
        '--server-url, -u <url>',
        'Server URL (env: TAPE6_SERVER_URL, default: http://localhost:3000)'
      ],
      ['--start-server', 'Auto-start tape6-server'],
      ['--h2', 'HTTP/2 mode: https server URL, --h2 self-launch (env: TAPE6_PROTOCOL=h2)'],
      ['--info', 'Show configuration info and exit'],
      ['--self', 'Print the path to this script and exit'],
      ['--help, -h', 'Show this help message and exit'],
      ['--version, -v', 'Show version and exit']
    ];
    console.log('Options:');
    const width = options.reduce((max, [flag]) => Math.max(max, flag.length), 0) + 2;
    for (const [flag, desc] of options) {
      console.log('  ' + flag.padEnd(width) + desc);
    }
    printFlagOptions();
    process.exit(0);
  };

  const probeServer = async serverUrl => {
    try {
      const response = await controlFetch(serverUrl + '/--tests');
      return response.ok ? 'ok' : 'down';
    } catch (error) {
      return isProtocolMismatch(error) ? 'mismatch' : 'down';
    }
  };

  const ensureServer = async (serverUrl, startServer, h2) => {
    const mismatchMsg =
      `Error: a TLS request to ${serverUrl} got a plaintext HTTP answer — ` +
      'an h1 (non-TLS) server is listening there.\n' +
      'Stop it, or drop --h2 / use an http: --server-url to match it.\n';

    let status = await probeServer(serverUrl);
    if (status === 'ok') return null;

    if (!startServer) {
      console.error(
        status === 'mismatch'
          ? mismatchMsg
          : `Error: tape6-server is not reachable at ${serverUrl}\n\n` +
              'Start it manually:\n' +
              `  npx tape6-server${h2 ? ' --h2' : ''}\n\n` +
              'Or re-run with --start-server:\n' +
              `  ${commandName} --start-server --flags FO\n`
      );
      process.exit(1);
    }

    if (status === 'mismatch') {
      // chained runs: the previous run's h1 server child may still be releasing
      // the port — give it a grace window before self-launching
      const graceDeadline = Date.now() + 4000;
      while (status === 'mismatch' && Date.now() < graceDeadline) {
        await sleep(250);
        status = await probeServer(serverUrl);
      }
      if (status === 'ok') return null;
      if (status === 'mismatch') {
        console.error(mismatchMsg);
        process.exit(1);
      }
    }

    // this module ships inside tape-six — its own server bin is two levels up
    const serverBin = fileURLToPath(new URL('../../bin/tape6-server.js', import.meta.url)),
      serverParts = new URL(serverUrl),
      host = serverParts.hostname,
      port = serverParts.port || '3000',
      // h2 server mode is Node-only (tape6-server refuses it elsewhere), so
      // under Bun/Deno the h2 server child runs on PATH's node
      execPath = h2 && runtime.name !== 'node' ? 'node' : process.execPath,
      child = spawn(execPath, h2 ? [serverBin, '--h2'] : [serverBin], {
        cwd: rootFolder,
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: false,
        env: {...process.env, HOST: host, PORT: port}
      });

    let exited = false,
      exitCode = null,
      stderrData = '';
    child.stderr.on('data', chunk => (stderrData += chunk));
    child.on('error', error => {
      exited = true;
      exitCode = null;
      stderrData += (error && error.message) || String(error);
    });
    child.on('exit', code => {
      exited = true;
      exitCode = code;
    });
    child.unref();

    const startDeadline = Date.now() + 15000;
    while (Date.now() < startDeadline) {
      await sleep(500);
      if (exited) {
        console.error(
          `Error: tape6-server exited with code ${exitCode} while starting on ${host}:${port}` +
            (stderrData ? '\n' + stderrData.trim() : '')
        );
        process.exit(1);
      }
      status = await probeServer(serverUrl);
      if (status === 'ok') return child;
      if (status === 'mismatch') {
        child.kill();
        console.error(mismatchMsg);
        process.exit(1);
      }
    }

    child.kill();
    console.error(
      `Error: tape6-server failed to start on ${host}:${port} (timed out after 15s)` +
        (stderrData ? '\n' + stderrData.trim() : '')
    );
    process.exit(1);
  };

  const options = getOptions({
    '--self': {fn: showSelf, isValueRequired: false},
    '--start-server': {isValueRequired: false},
    '--h2': {isValueRequired: false},
    '--info': {isValueRequired: false},
    '--server-url': {aliases: ['-u'], initialValue: getServerUrl(), isValueRequired: true},
    '--browser': {
      aliases: ['-b'],
      initialValue: process.env.TAPE6_BROWSER || supportedBrowsers[0],
      isValueRequired: true
    },
    '--browsers': {initialValue: process.env.TAPE6_BROWSERS || '', isValueRequired: true},
    '--help': {aliases: ['-h'], fn: showHelp, isValueRequired: false},
    '--version': {aliases: ['-v'], fn: showVersion, isValueRequired: false}
  });

  // mirrors tape6-server's flag > env > config resolution, so the URL scheme
  // below agrees with the protocol a self-launched server will pick
  let protocol = options.optionFlags['--h2'] === '' ? 'h2' : process.env.TAPE6_PROTOCOL || '';
  if (!protocol) protocol = (await getConfig(rootFolder)).server?.protocol || 'h1';

  let serverUrl = options.optionFlags['--server-url'].replace(/\/+$/, '');
  if (protocol === 'h2') serverUrl = serverUrl.replace(/^http:/i, 'https:');
  // an explicit https: --server-url means TLS regardless of --h2
  const secure = /^https:/i.test(serverUrl);

  options.flags.serverUrl = serverUrl;
  options.flags.browser = options.optionFlags['--browser'];

  const resolved = resolveBrowsers(
    options.optionFlags['--browsers'],
    options.flags.browser,
    supportedBrowsers
  );
  if (resolved.badBrowser !== undefined) {
    console.error(
      `Error: unsupported browser "${resolved.badBrowser}". Choose one of: ${supportedBrowsers.join(', ')}.`
    );
    await new Promise(r => process.stderr.write('', r));
    process.exitCode = 1;
    return;
  }
  const browsers = resolved.browsers;

  await Promise.all([initReporter(getReporter, setReporter, options.flags), selectTimer()]);

  if (options.optionFlags['--info'] === '') {
    showInfo(options, []);
    await new Promise(r => process.stdout.write('', r));
    process.exitCode = 0;
    return;
  }

  const startServer = options.optionFlags['--start-server'] === '';

  const serverChild = await ensureServer(serverUrl, startServer, secure);

  console.log(
    `Connected to ${serverUrl} (${serverChild ? 'self-launched' : 'external'}); ` +
      (browsers.length > 1 ? `browsers: ${browsers.join(', ')}` : `browser: ${browsers[0]}`)
  );

  const shutdown = code => {
    serverChild?.kill();
    process.exit(code);
  };

  process.on('uncaughtException', (error, origin) => {
    console.error('UNHANDLED ERROR:', origin, error);
    shutdown(1);
  });

  let files = [];
  try {
    if (options.files.length) {
      const query = options.files.map(p => 'q=' + encodeURIComponent(p)).join('&');
      const response = await controlFetch(serverUrl + '/--patterns?' + query);
      if (response.ok) files = await response.json();
    }
    if (!files.length) {
      const response = await controlFetch(serverUrl + '/--tests');
      if (response.ok) files = await response.json();
    }
  } catch {}

  if (!files.length) {
    console.log('No test files found on the server.');
    shutdown(1);
  }

  let importmap = null;
  try {
    const response = await controlFetch(serverUrl + '/--importmap');
    if (response.ok) importmap = await response.json();
  } catch {}

  const failedBrowsers = [];
  for (let i = 0; i < browsers.length; ++i) {
    const browser = browsers[i];
    if (i) {
      // fresh reporter per engine (correct per-engine counts and summary):
      // initReporter() only constructs into an empty slot
      setReporter(null);
      await initReporter(getReporter, setReporter, options.flags);
    }
    if (browsers.length > 1) console.log(`\nBrowser: ${browser}`);

    const reporter = getReporter(),
      worker = new TestWorker(reporter, options.parallel, {
        ...options.flags,
        browser,
        serverUrl,
        importmap
      });

    reporter.report({type: 'test', test: 0});

    await new Promise(resolve => {
      worker.done = () => resolve();
      worker.execute(files);
    });

    const hasFailed = reporter.state && reporter.state.failed > 0;

    reporter.report({
      type: 'end',
      test: 0,
      fail: hasFailed
    });

    await worker.cleanup();

    if (hasFailed) failedBrowsers.push(browser);
  }

  if (browsers.length > 1) {
    console.log(
      '\nBrowsers: ' +
        browsers.map(name => name + (failedBrowsers.includes(name) ? ' FAIL' : ' PASS')).join(', ')
    );
  }

  serverChild?.kill();
  await new Promise(r => process.stdout.write('', r));
  process.exitCode = failedBrowsers.length ? 1 : 0;
};

export default runDriverCli;
