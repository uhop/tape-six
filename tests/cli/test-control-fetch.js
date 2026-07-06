import test from '../../index.js';
import {withServer} from '../../src/server.js';
import {createControlFetch, isProtocolMismatch} from '../../src/utils/controlFetch.js';

// The scoped-TLS ladder and the 3s deadline are exercised end-to-end by the
// browser providers (chained h1/h2, mismatch, silent-listener scenarios); this
// covers the core-owned surface: the mismatch predicate and the http: path.

const json = body => (_req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
};

test('controlFetch: isProtocolMismatch recognizes TLS-vs-plaintext failures', t => {
  t.ok(isProtocolMismatch(Object.assign(new Error('boom'), {code: 'EPROTO'})), 'EPROTO code');
  t.ok(isProtocolMismatch(new Error('ssl3_get_record:wrong version number')), 'openssl message');
  t.notOk(isProtocolMismatch(new Error('connect ECONNREFUSED')), 'unrelated error');
  t.notOk(isProtocolMismatch(null), 'null');
  t.notOk(isProtocolMismatch(undefined), 'undefined');
});

test('controlFetch: http URLs return the control response surface', t =>
  withServer(json({tests: ['a.js', 'b.js']}), async base => {
    const controlFetch = createControlFetch();
    const response = await controlFetch(`${base}/--tests`);
    t.ok(response.ok, 'ok');
    t.equal(response.status, 200, 'status 200');
    t.deepEqual(await response.json(), {tests: ['a.js', 'b.js']}, 'json body');
  }));

test('controlFetch: non-2xx surfaces as ok=false, not a throw', t =>
  withServer(
    (_req, res) => {
      res.writeHead(404);
      res.end('nope');
    },
    async base => {
      const controlFetch = createControlFetch();
      const response = await controlFetch(`${base}/--missing`);
      t.notOk(response.ok, 'not ok');
      t.equal(response.status, 404, 'status 404');
    }
  ));
