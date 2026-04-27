// @ts-self-types="./server.d.ts"

import http from 'node:http';
import {once} from 'node:events';

import {beforeAll, afterAll} from './test.js';

const DEFAULT_HOST = '127.0.0.1';

export const startServer = async (server, {host = DEFAULT_HOST, port = 0} = {}) => {
  const listening = once(server, 'listening');
  const failure = once(server, 'error').then(([err]) => {
    throw err;
  });
  server.listen(port, host);
  await Promise.race([listening, failure]);

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  const base = `http://${host}:${actualPort}`;

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    server.closeAllConnections?.();
    server.close();
    await once(server, 'close');
  };

  return {server, base, port: actualPort, host, close};
};

export const withServer = async (serverHandler, clientHandler, opts) => {
  const server = http.createServer(serverHandler);
  const lifecycle = await startServer(server, opts);
  try {
    return await clientHandler(lifecycle.base, lifecycle);
  } finally {
    await lifecycle.close();
  }
};

export const setupServer = (serverHandler, opts) => {
  let lifecycle = null;
  beforeAll(async () => {
    lifecycle = await startServer(http.createServer(serverHandler), opts);
  });
  afterAll(async () => {
    if (lifecycle) {
      await lifecycle.close();
      lifecycle = null;
    }
  });
  return Object.freeze({
    get server() {
      return lifecycle?.server;
    },
    get base() {
      return lifecycle?.base;
    },
    get port() {
      return lifecycle?.port;
    },
    get host() {
      return lifecycle?.host;
    }
  });
};
