import http from 'node:http';

import test from '../index.js';
import {startServer, withServer, setupServer} from '../src/server.js';

const echo = (req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(`echo ${req.method} ${req.url}`);
};

test('startServer: binds to ephemeral port and serves requests', async t => {
  const lc = await startServer(http.createServer(echo));
  try {
    t.ok(lc.port > 0, 'port was assigned');
    t.equal(lc.host, '127.0.0.1', 'default host is 127.0.0.1');
    t.equal(lc.base, `http://127.0.0.1:${lc.port}`, 'base URL matches');
    const res = await fetch(`${lc.base}/hello`);
    t.equal(res.status, 200);
    t.equal(await res.text(), 'echo GET /hello');
  } finally {
    await lc.close();
  }
});

test('startServer: close() is idempotent', async t => {
  const lc = await startServer(http.createServer(echo));
  await lc.close();
  await lc.close();
  t.pass('second close did not throw');
});

test('startServer: rejects on port conflict instead of hanging', async t => {
  const first = await startServer(http.createServer(echo));
  try {
    const second = http.createServer(echo);
    await t.rejects(
      startServer(second, {port: first.port}),
      err => err && err.code === 'EADDRINUSE',
      'second listen rejects with EADDRINUSE'
    );
    second.close();
  } finally {
    await first.close();
  }
});

test('startServer: honors custom host', async t => {
  const lc = await startServer(http.createServer(echo), {host: '127.0.0.1'});
  try {
    t.equal(lc.host, '127.0.0.1');
    t.ok(lc.base.startsWith('http://127.0.0.1:'));
  } finally {
    await lc.close();
  }
});

test('withServer: happy path', t =>
  withServer(echo, async base => {
    const res = await fetch(`${base}/foo`);
    t.equal(res.status, 200);
    t.equal(await res.text(), 'echo GET /foo');
  }));

test('withServer: passes lifecycle handle as second arg', t =>
  withServer(echo, async (base, lc) => {
    t.equal(typeof lc.close, 'function', 'lifecycle.close is a function');
    t.equal(lc.base, base, 'lifecycle.base matches base arg');
    t.ok(lc.port > 0);
  }));

test('withServer: cleans up when clientHandler rejects', async t => {
  let lifecycle = null;
  await t.rejects(
    withServer(echo, (_base, lc) => {
      lifecycle = lc;
      throw new Error('boom');
    }),
    /boom/
  );
  // The server has been closed even though the body threw — verify by trying
  // to connect. A closed server refuses new connections with ECONNREFUSED.
  await t.rejects(fetch(lifecycle.base), 'connection refused after teardown');
});

test('withServer: cleans up when clientHandler returns a rejected promise', async t => {
  let lifecycle = null;
  await t.rejects(
    withServer(echo, async (_base, lc) => {
      lifecycle = lc;
      throw new Error('async-boom');
    }),
    /async-boom/
  );
  await t.rejects(fetch(lifecycle.base));
});

test('withServer: returns clientHandler value', async t => {
  const result = await withServer(echo, () => 42);
  t.equal(result, 42);
  const asyncResult = await withServer(echo, async () => 'hello');
  t.equal(asyncResult, 'hello');
});

test('setupServer: shared across embedded tests in a suite', async t => {
  const server = setupServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(`hello ${req.url}`);
  });

  // The hooks registered by setupServer fire around the embedded tests below.

  await t.test('first sub-test sees the running server', async t => {
    t.ok(server.base, 'base is populated by beforeAll');
    const res = await fetch(`${server.base}/one`);
    t.equal(await res.text(), 'hello /one');
  });

  await t.test('second sub-test sees the same server', async t => {
    const res = await fetch(`${server.base}/two`);
    t.equal(await res.text(), 'hello /two');
  });
});

test('setupServer: returns a frozen handle', t => {
  const server = setupServer(echo);
  t.equal(Object.isFrozen(server), true, 'returned object is frozen');
});

test('setupServer: per-test state reset via beforeEach (mock-server pattern)', async t => {
  let recorded;
  const server = setupServer((req, res) => {
    recorded.push({method: req.method, url: req.url});
    res.writeHead(204).end();
  });
  t.beforeEach(() => {
    recorded = [];
  });

  await t.test('first call records exactly one request', async t => {
    await fetch(`${server.base}/a`);
    t.equal(recorded.length, 1);
    t.equal(recorded[0].url, '/a');
  });

  await t.test('second call sees a fresh recorder', async t => {
    await fetch(`${server.base}/b`);
    t.equal(recorded.length, 1, 'recorder was reset between tests');
    t.equal(recorded[0].url, '/b');
  });
});
