// @ts-self-types="./test-server.d.ts"

import http from 'node:http';
import http2 from 'node:http2';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {getConfig, runtime} from './utils/config.js';
import {startServer} from './server.js';
import {toRequest, respondWith, writeResponse} from './test-server/adapter.js';
import {PluginRegistry} from './test-server/registry.js';
import {createControl} from './test-server/control.js';
import {createStatics} from './test-server/statics.js';
import {makeTrace} from './test-server/trace.js';
import {resolveCerts} from './test-server/certs.js';

const defaultWebAppPath = rootFolder => {
  const url = import.meta.url;
  if (!/^file:\/\//i.test(url))
    throw Error('Cannot identify the location of the web application. Use webAppPath.');
  let webAppPath = path.relative(
    rootFolder,
    path.join(path.dirname(fileURLToPath(url)), '../web-app/')
  );
  if (path.sep === path.win32.sep)
    webAppPath = webAppPath.replaceAll(path.win32.sep, path.posix.sep);
  return webAppPath;
};

export const createTestServer = async (options = {}) => {
  const rootFolder = path.resolve(options.rootFolder || process.cwd()),
    config = await getConfig(rootFolder),
    serverConfig = config.server || {},
    protocol = options.protocol || serverConfig.protocol || 'h1',
    host = options.host || '127.0.0.1',
    port = options.port ?? 0,
    log = options.log || console.log,
    remotePlugins = options.remotePlugins !== false && serverConfig.remotePlugins !== false,
    webAppPath = options.webAppPath || serverConfig.webAppPath || defaultWebAppPath(rootFolder),
    trace = makeTrace({enabled: !!options.trace, log, hasColors: options.hasColors});

  if (protocol != 'h1' && protocol != 'h2')
    throw Error('unsupported protocol: ' + protocol + ' (expected "h1" or "h2")');

  const api = {rootFolder, config, base: '', protocol, log, trace};
  const registry = new PluginRegistry(api);
  const control = createControl({rootFolder, registry, remotePlugins});
  const statics = createStatics({rootFolder, webAppPath, trace});

  const handler = async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname,
        method = req.method.toUpperCase();
      let request = null;
      const getRequest = () => (request ??= toRequest(req, res));
      const endpoint = control.match(pathname);
      if (endpoint) {
        const status = await writeResponse(res, await endpoint(getRequest()), method);
        return trace(status, req);
      }
      for (const plugin of registry.find(pathname)) {
        if (plugin.raw) {
          if ((await plugin.raw(req, res, api)) !== false) return trace(res.statusCode, req);
          continue;
        }
        const status = await respondWith(res, await plugin.fetch(getRequest(), api), method);
        if (status !== undefined) return trace(status, req);
      }
      await statics(req, res);
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
      } else {
        res.writeHead(500, {'content-type': 'text/plain; charset=utf-8'});
        res.end(String((error && error.stack) || error) + '\n');
      }
      trace(500, req);
    }
  };

  let server,
    sessions = null,
    scheme = 'http';
  if (protocol == 'h2') {
    if (runtime.name != 'node')
      throw Error('h2 server mode requires Node (node:http2); run the server under Node');
    const {cert, key} = await resolveCerts({
      cert: options.cert || serverConfig.cert,
      key: options.key || serverConfig.key,
      rootFolder,
      host,
      log
    });
    server = http2.createSecureServer({allowHTTP1: true, cert, key}, handler);
    sessions = new Set();
    server.on('session', session => {
      sessions.add(session);
      session.on('close', () => sessions.delete(session));
    });
    server.on('sessionError', (_error, session) => session.destroy());
    scheme = 'https';
  } else {
    server = http.createServer(handler);
  }
  server.on('clientError', (error, socket) => {
    if (error.code === 'ECONNRESET' || !socket.writable) return;
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  const lifecycle = await startServer(server, {host, port});
  api.base = scheme + '://' + lifecycle.host + ':' + lifecycle.port;

  const staticPlugins = [];
  if (Array.isArray(serverConfig.plugins)) staticPlugins.push(...serverConfig.plugins);
  if (Array.isArray(options.plugins)) staticPlugins.push(...options.plugins);
  try {
    for (const spec of staticPlugins) await registry.register(spec, {source: 'static'});
  } catch (error) {
    await lifecycle.close();
    throw error;
  }

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await registry.closeAll();
    if (sessions) for (const session of sessions) session.destroy();
    await lifecycle.close();
  };

  return {
    server,
    protocol,
    base: api.base,
    host: lifecycle.host,
    port: lifecycle.port,
    config,
    register: (spec, opts) => registry.register(spec, {source: 'dynamic', ...opts}),
    deregister: name => registry.deregister(name),
    plugins: () => registry.list(),
    close
  };
};

export const withTestServer = async (options, clientHandler) => {
  const testServer = await createTestServer(options);
  try {
    return await clientHandler(testServer.base, testServer);
  } finally {
    await testServer.close();
  }
};
