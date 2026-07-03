#!/usr/bin/env node

import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {printVersion, printHelp} from '../src/utils/config.js';
import {createTestServer} from '../src/test-server.js';
import {detectColors, makePaint} from '../src/test-server/trace.js';

const showSelf = () => {
  const self = new URL(import.meta.url);
  if (self.protocol === 'file:') {
    console.log(fileURLToPath(self));
  } else {
    console.log(self);
  }
  process.exit(0);
};
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp('tape6-server', 'Pluggable test server for browser testing', 'tape6-server [options]', [
    ['--plugin path', 'Register a plugin module (repeatable)'],
    ['--h2', 'Serve HTTPS with HTTP/2 (+ HTTP/1.1 via ALPN); Node only'],
    ['--no-remote-plugins', 'Disable PUT/DELETE on /--plugins'],
    ['--trace', 'Enable request trace logging'],
    ['--self', 'Print the path to this script and exit'],
    ['--help, -h', 'Show this help message and exit'],
    ['--version, -v', 'Show version and exit']
  ]);
  console.log('\nEnvironment:');
  console.log('  HOST            Server hostname (default: localhost)');
  console.log('  PORT            Server port (default: 3000)');
  console.log('  SERVER_ROOT     Root directory for serving files (default: cwd)');
  console.log('  WEBAPP_PATH     Path to the web app directory');
  console.log('  TAPE6_PROTOCOL  Protocol: h1 or h2 (default: h1)');
  console.log('  TAPE6_CERT      Path to a TLS certificate (h2)');
  console.log('  TAPE6_KEY       Path to its private key (h2)');
  process.exit(0);
}
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  printVersion('tape6-server');
  process.exit(0);
}
if (process.argv.includes('--self')) showSelf();

const plugins = [];
let traceCalls = false,
  h2 = false,
  remotePlugins = true;
{
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg === '--trace') {
      traceCalls = true;
    } else if (arg === '--h2') {
      h2 = true;
    } else if (arg === '--no-remote-plugins') {
      remotePlugins = false;
    } else if (arg === '--plugin') {
      if (++i < args.length) plugins.push(args[i]);
    } else if (arg.startsWith('--plugin=')) {
      plugins.push(arg.substring('--plugin='.length));
    }
  }
}

const normalizePort = val => {
  const port = parseInt(val);
  if (isNaN(port)) return val; // named pipe
  if (port >= 0) return port;
  return false;
};

const portToString = port => (typeof port === 'string' ? 'pipe' : 'port') + ' ' + port;

const host = process.env.HOST || 'localhost',
  port = normalizePort(process.env.PORT || '3000'),
  rootFolder = process.env.SERVER_ROOT || process.cwd(),
  protocol = h2 ? 'h2' : process.env.TAPE6_PROTOCOL || undefined;

const hasColors = detectColors(),
  paint = makePaint(hasColors),
  grey = paint('\x1B[2;37m', '\x1B[22;39m'),
  red = paint('\x1B[41;97m', '\x1B[49;39m'),
  yellow = paint('\x1B[93m');

const link = (url, text = url) => paint('\x1B]8;;' + url + '\x1B\\', '\x1B]8;;\x1B\\')(text);

try {
  const testServer = await createTestServer({
    rootFolder,
    webAppPath: process.env.WEBAPP_PATH,
    host,
    port,
    protocol,
    plugins,
    remotePlugins,
    trace: traceCalls
  });
  const bind = portToString(testServer.port);
  console.log(
    grey('Listening on ') +
      yellow(host || 'all network interfaces') +
      yellow(' (' + testServer.protocol + ')') +
      grey(' at ') +
      yellow(bind) +
      grey(', serving static files from ') +
      yellow(rootFolder)
  );
  const mounted = testServer.plugins();
  if (mounted.length) {
    console.log(
      grey('Plugins: ') +
        yellow(mounted.map(p => p.name + (p.prefix ? ' (' + p.prefix + ')' : '')).join(', '))
    );
  }
  console.log(grey('Open ') + link(testServer.base + '/') + grey(' in your browser'));
  console.log();
} catch (error) {
  if (error.syscall === 'listen') {
    const bind = portToString(port);
    if (error.code === 'EACCES') {
      console.log(red('Error: ') + yellow(bind) + red(' requires elevated privileges') + '\n');
      process.exitCode = 1;
    } else if (error.code === 'EADDRINUSE') {
      console.log(red('Error: ') + yellow(bind) + red(' is already in use') + '\n');
      process.exitCode = 1;
    } else {
      throw error;
    }
  } else {
    throw error;
  }
}
