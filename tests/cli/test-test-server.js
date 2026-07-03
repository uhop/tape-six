import path from 'node:path';
import {fileURLToPath} from 'node:url';

import test from '../../index.js';
import {createTestServer, withTestServer} from '../../src/test-server.js';
import echo from '../../src/test-server/plugins/echo.js';

const rootFolder = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const deferred = () => {
  const result = {};
  result.promise = new Promise(resolve => (result.resolve = resolve));
  return result;
};

test('test server: statics + control endpoints', async t => {
  const ts = await createTestServer({rootFolder});
  try {
    t.ok(ts.port > 0, 'port was assigned');
    t.equal(ts.protocol, 'h1');
    t.equal(ts.base, `http://127.0.0.1:${ts.port}`);

    const pkg = await fetch(ts.base + '/package.json');
    t.equal(pkg.status, 200);
    t.equal(pkg.headers.get('content-type'), 'application/json');
    t.equal((await pkg.json()).name, 'tape-six');

    const tests = await fetch(ts.base + '/--tests');
    t.equal(tests.status, 200);
    t.ok(Array.isArray(await tests.json()), '/--tests returns an array');

    const importmap = await fetch(ts.base + '/--importmap');
    t.ok((await importmap.json()).imports, '/--importmap returns an import map');

    const missing = await fetch(ts.base + '/no-such-file.js');
    t.equal(missing.status, 404);

    const post = await fetch(ts.base + '/package.json', {method: 'POST', body: 'x'});
    t.equal(post.status, 405, 'statics are GET/HEAD only');

    const redirect = await fetch(ts.base + '/', {redirect: 'manual'});
    t.equal(redirect.status, 307, 'root redirects to the web app');

    const escape = await fetch(ts.base + '/../secret');
    t.ok(escape.status === 403 || escape.status === 404, 'path traversal is rejected');
  } finally {
    await ts.close();
  }
});

test('test server: echo plugin (inline registration)', async t => {
  const ts = await createTestServer({rootFolder, plugins: [echo]});
  try {
    t.deepEqual(ts.plugins(), [{name: 'echo', prefix: '/--echo', source: 'static'}]);

    const res = await fetch(ts.base + '/--echo/x?a=1&b=2', {
      method: 'POST',
      headers: {'x-test': 'yes'},
      body: 'hello'
    });
    t.equal(res.status, 200);
    const echoed = await res.json();
    t.equal(echoed.method, 'POST');
    t.equal(echoed.path, '/--echo/x');
    t.deepEqual(echoed.query, {a: '1', b: '2'});
    t.equal(echoed.headers['x-test'], 'yes');
    t.equal(echoed.body, 'hello');

    const head = await fetch(ts.base + '/--echo/x', {method: 'HEAD'});
    t.equal(head.status, 200);
    t.equal(await head.text(), '', 'HEAD gets headers only');
  } finally {
    await ts.close();
  }
});

test('test server: module plugin with options', t =>
  withTestServer(
    {
      rootFolder,
      plugins: [{module: 'tests/cli/fixtures/greeting-plugin.js', options: {message: 'hi!'}}]
    },
    async (base, ts) => {
      t.deepEqual(ts.plugins(), [
        {name: 'greeting-plugin', prefix: '/--greeting', source: 'static'}
      ]);
      const res = await fetch(base + '/--greeting');
      t.equal(await res.text(), 'hi!', 'options reached the factory');
    }
  ));

test('test server: generator plugin streams JSONL', t =>
  withTestServer(
    {
      rootFolder,
      plugins: [
        {
          name: 'numbers',
          prefix: '/--numbers',
          async *fetch(request) {
            const n = Number(new URL(request.url).searchParams.get('n')) || 3;
            for (let i = 0; i < n; ++i) yield {n: i};
          }
        }
      ]
    },
    async base => {
      const res = await fetch(base + '/--numbers?n=4');
      t.equal(res.status, 200);
      t.equal(res.headers.get('content-type'), 'application/x-ndjson');
      const lines = (await res.text()).trimEnd().split('\n');
      t.deepEqual(
        lines.map(line => JSON.parse(line)),
        [{n: 0}, {n: 1}, {n: 2}, {n: 3}]
      );
    }
  ));

test('test server: bare generator function is a catch-all plugin', t =>
  withTestServer(
    {
      rootFolder,
      plugins: [
        async function* letters() {
          yield 'a';
          yield 'b';
        }
      ]
    },
    async (base, ts) => {
      t.deepEqual(ts.plugins(), [{name: 'letters', prefix: '', source: 'static'}]);
      const res = await fetch(base + '/anything/at/all');
      t.equal(res.status, 200);
      t.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
      t.equal(await res.text(), 'ab');
    }
  ));

test('test server: longest prefix wins; undefined passes through', async t => {
  const ts = await createTestServer({
    rootFolder,
    plugins: [
      {name: 'outer', prefix: '/--api/', fetch: () => new Response('outer')},
      {
        name: 'inner',
        prefix: '/--api/inner/',
        fetch: request =>
          new URL(request.url).searchParams.has('pass') ? undefined : new Response('inner')
      }
    ]
  });
  try {
    t.equal(await (await fetch(ts.base + '/--api/x')).text(), 'outer');
    t.equal(await (await fetch(ts.base + '/--api/inner/x')).text(), 'inner');
    t.equal(
      await (await fetch(ts.base + '/--api/inner/x?pass')).text(),
      'outer',
      'undefined falls through to the next plugin'
    );
  } finally {
    await ts.close();
  }
});

test('test server: raw escape hatch', t =>
  withTestServer(
    {
      rootFolder,
      plugins: [
        {
          name: 'filter',
          prefix: '/--raw/',
          raw: (req, res) => {
            if (req.url.endsWith('?pass')) return false;
            res.writeHead(201, {'content-type': 'text/plain'});
            res.end('raw!');
          }
        },
        {name: 'behind', prefix: '/--raw/', fetch: () => new Response('behind')}
      ]
    },
    async base => {
      const handled = await fetch(base + '/--raw/x');
      t.equal(handled.status, 201);
      t.equal(await handled.text(), 'raw!');
      t.equal(await (await fetch(base + '/--raw/x?pass')).text(), 'behind', 'false passes through');
    }
  ));

test('test server: dynamic registration over the wire', async t => {
  const ts = await createTestServer({rootFolder});
  try {
    let res = await fetch(ts.base + '/--plugins');
    t.deepEqual(await res.json(), [], 'no plugins initially');

    res = await fetch(ts.base + '/--plugins', {
      method: 'PUT',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({module: 'src/test-server/plugins/echo.js'})
    });
    t.equal(res.status, 200);
    t.deepEqual(await res.json(), {name: 'echo', prefix: '/--echo', source: 'dynamic'});

    res = await fetch(ts.base + '/--echo/hi');
    t.equal(res.status, 200);
    t.equal((await res.json()).path, '/--echo/hi');

    res = await fetch(ts.base + '/--plugins/echo');
    t.deepEqual(await res.json(), {name: 'echo', prefix: '/--echo', source: 'dynamic'});

    res = await fetch(ts.base + '/--plugins/echo', {method: 'DELETE'});
    t.equal(res.status, 204);

    res = await fetch(ts.base + '/--echo/hi');
    t.equal(res.status, 404, 'a deregistered plugin no longer routes');

    res = await fetch(ts.base + '/--plugins/echo', {method: 'DELETE'});
    t.equal(res.status, 404, 'double delete reports unknown');
  } finally {
    await ts.close();
  }
});

test('test server: PUT replaces by name, close() runs on replace and shutdown', async t => {
  const closes = [];
  const make = id => ({
    name: 'replaceable',
    prefix: '/--replaceable',
    fetch: () => new Response(id),
    close: () => closes.push(id)
  });
  const ts = await createTestServer({rootFolder, plugins: [make('one')]});
  try {
    t.equal(await (await fetch(ts.base + '/--replaceable')).text(), 'one');
    await ts.register(make('two'));
    t.deepEqual(closes, ['one'], 'the old instance was closed on replace');
    t.equal(await (await fetch(ts.base + '/--replaceable')).text(), 'two');
    t.equal(ts.plugins().length, 1, 'one namespace: replaced, not duplicated');
  } finally {
    await ts.close();
  }
  t.deepEqual(closes, ['one', 'two'], 'shutdown closed the live instance');
});

test('test server: containment and disabled remote registration', async t => {
  await withTestServer({rootFolder}, async base => {
    const res = await fetch(base + '/--plugins', {
      method: 'PUT',
      body: JSON.stringify({module: '../outside.js'})
    });
    t.equal(res.status, 403, 'a module escaping rootFolder is rejected');
  });
  await withTestServer({rootFolder, remotePlugins: false}, async base => {
    const res = await fetch(base + '/--plugins', {
      method: 'PUT',
      body: JSON.stringify({module: 'src/test-server/plugins/echo.js'})
    });
    t.equal(res.status, 403, 'PUT is disabled');
    const list = await fetch(base + '/--plugins');
    t.equal(list.status, 200, 'GET listing is still available');
  });
});

test('test server: client disconnect aborts request.signal', {timeout: 15000}, async t => {
  const arrived = deferred(),
    aborted = deferred();
  const ts = await createTestServer({
    rootFolder,
    plugins: [
      {
        name: 'hang',
        prefix: '/--hang',
        fetch: request =>
          new Promise(() => {
            request.signal.addEventListener('abort', () => aborted.resolve(true));
            arrived.resolve(true);
          })
      }
    ]
  });
  try {
    const controller = new AbortController();
    const client = fetch(ts.base + '/--hang', {signal: controller.signal}).catch(() => null);
    await arrived.promise;
    controller.abort();
    t.equal(await aborted.promise, true, 'the server saw the abort');
    await client;
  } finally {
    await ts.close();
  }
});

test('test server: client disconnect stops a streaming generator', {timeout: 15000}, async t => {
  const stopped = deferred();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ts = await createTestServer({
    rootFolder,
    plugins: [
      {
        name: 'ticker',
        prefix: '/--ticker',
        async *fetch() {
          try {
            for (;;) {
              yield 'tick\n';
              await sleep(10);
            }
          } finally {
            stopped.resolve(true);
          }
        }
      }
    ]
  });
  try {
    const controller = new AbortController();
    const res = await fetch(ts.base + '/--ticker', {signal: controller.signal});
    const reader = res.body.getReader();
    await reader.read();
    await reader.read();
    controller.abort();
    t.equal(await stopped.promise, true, 'the generator was terminated');
  } finally {
    await ts.close();
  }
});

test('test server: withTestServer cleans up on failure', async t => {
  let saved = '';
  await t.rejects(
    withTestServer({rootFolder}, base => {
      saved = base;
      throw Error('boom');
    }),
    /boom/
  );
  await t.rejects(fetch(saved), 'connection refused after teardown');
});
