import http2 from 'node:http2';
import https from 'node:https';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import test from '../../index.js';
import {createTestServer} from '../../src/test-server.js';
import {resolveCerts} from '../../src/test-server/certs.js';
import echo from '../../src/test-server/plugins/echo.js';

const rootFolder = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const hasOpenssl = () => {
  try {
    execFileSync('openssl', ['version'], {stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
};

const h2Get = (client, headers) =>
  new Promise((resolve, reject) => {
    const req = client.request(headers);
    let status = 0,
      data = '';
    req.setEncoding('utf8');
    req.on('response', responseHeaders => (status = responseHeaders[':status']));
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve({status, data}));
    req.on('error', reject);
    req.end();
  });

test('h2 test server: ALPN serves h2 and http/1.1 on one HTTPS port', {timeout: 30000}, async t => {
  if (!hasOpenssl()) {
    t.skipTest('openssl is not available');
    return;
  }

  const ts = await createTestServer({rootFolder, protocol: 'h2', plugins: [echo]});
  try {
    t.equal(ts.protocol, 'h2');
    t.ok(ts.base.startsWith('https://'), 'base URL is https');

    const client = http2.connect(ts.base, {rejectUnauthorized: false});
    try {
      const echoed = await h2Get(client, {':path': '/--echo/x?a=1'});
      t.equal(echoed.status, 200);
      const parsed = JSON.parse(echoed.data);
      t.equal(parsed.method, 'GET');
      t.equal(parsed.path, '/--echo/x');
      t.deepEqual(parsed.query, {a: '1'});

      const pkg = await h2Get(client, {':path': '/package.json'});
      t.equal(pkg.status, 200);
      t.equal(JSON.parse(pkg.data).name, 'tape-six', 'statics work over h2');
    } finally {
      client.close();
    }

    const h1 = await new Promise((resolve, reject) => {
      https
        .get(ts.base + '/package.json', {rejectUnauthorized: false}, res => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', chunk => (data += chunk));
          res.on('end', () => resolve({status: res.statusCode, data}));
        })
        .on('error', reject);
    });
    t.equal(h1.status, 200, 'http/1.1 over TLS is served via allowHTTP1');
    t.equal(JSON.parse(h1.data).name, 'tape-six');
  } finally {
    await ts.close();
  }
});

test('h2 test server: certs are cached and reused', {timeout: 30000}, async t => {
  if (!hasOpenssl()) {
    t.skipTest('openssl is not available');
    return;
  }

  const first = await resolveCerts({rootFolder, host: '127.0.0.1'});
  const second = await resolveCerts({rootFolder, host: '127.0.0.1'});
  t.ok(first.cert.length > 0);
  t.ok(first.cert.equals(second.cert), 'the cached certificate was reused');
  t.ok(first.key.equals(second.key), 'the cached key was reused');
});
