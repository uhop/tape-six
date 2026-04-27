import http from 'node:http';

import test from '../index.js';
import {withServer} from '../src/server.js';
import {asText, asJson, asBytes, header, headers} from '../src/response.js';

const json = body => (_req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
};

const text = body => (_req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
  res.end(body);
};

const bytes = buf => (_req, res) => {
  res.writeHead(200, {'Content-Type': 'application/octet-stream', 'Content-Length': buf.length});
  res.end(buf);
};

const multiHeader = (_req, res) => {
  res.setHeader('Set-Cookie', ['a=1', 'b=2']);
  res.setHeader('Content-Type', 'text/plain');
  res.writeHead(200);
  res.end('ok');
};

// IncomingMessage helper: do an http.get and yield the response object directly
// (without consuming the body), so we can hand it to the helpers under test.
const getIncomingMessage = url =>
  new Promise((resolve, reject) => {
    const req = http.get(url, resolve);
    req.on('error', reject);
  });

// --- asText ---

test('asText: reads Response body', t =>
  withServer(text('hello'), async base => {
    const res = await fetch(`${base}/`);
    t.equal(await asText(res), 'hello');
  }));

test('asText: reads IncomingMessage body', t =>
  withServer(text('hello node'), async base => {
    const im = await getIncomingMessage(`${base}/`);
    t.equal(await asText(im), 'hello node');
  }));

// --- asJson ---

test('asJson: parses Response body', t =>
  withServer(json({ok: true, n: 42}), async base => {
    const res = await fetch(`${base}/`);
    const body = await asJson(res);
    t.deepEqual(body, {ok: true, n: 42});
  }));

test('asJson: parses IncomingMessage body', t =>
  withServer(json({a: [1, 2, 3]}), async base => {
    const im = await getIncomingMessage(`${base}/`);
    const body = await asJson(im);
    t.deepEqual(body, {a: [1, 2, 3]});
  }));

// --- asBytes ---

test('asBytes: returns Uint8Array from Response', t =>
  withServer(bytes(Buffer.from([1, 2, 3, 4])), async base => {
    const res = await fetch(`${base}/`);
    const buf = await asBytes(res);
    t.ok(buf instanceof Uint8Array);
    t.deepEqual(Array.from(buf), [1, 2, 3, 4]);
  }));

test('asBytes: returns Uint8Array from IncomingMessage', t =>
  withServer(bytes(Buffer.from([9, 8, 7])), async base => {
    const im = await getIncomingMessage(`${base}/`);
    const buf = await asBytes(im);
    t.ok(buf instanceof Uint8Array);
    t.deepEqual(Array.from(buf), [9, 8, 7]);
  }));

// --- header ---

test('header: reads single value from Response (case-insensitive)', t =>
  withServer(text('x'), async base => {
    const res = await fetch(`${base}/`);
    t.equal(header(res, 'content-type'), 'text/plain; charset=utf-8');
    t.equal(header(res, 'CONTENT-TYPE'), 'text/plain; charset=utf-8');
    t.equal(header(res, 'x-missing'), null, 'missing header returns null');
    await asText(res);
  }));

test('header: reads single value from IncomingMessage', t =>
  withServer(text('x'), async base => {
    const im = await getIncomingMessage(`${base}/`);
    t.equal(header(im, 'content-type'), 'text/plain; charset=utf-8');
    t.equal(header(im, 'Content-Type'), 'text/plain; charset=utf-8');
    t.equal(header(im, 'x-missing'), null, 'missing header returns null');
    await asText(im);
  }));

test('header: joins array-valued IncomingMessage headers', t =>
  withServer(multiHeader, async base => {
    const im = await getIncomingMessage(`${base}/`);
    t.equal(header(im, 'set-cookie'), 'a=1, b=2');
    await asText(im);
  }));

// --- headers ---

test('headers: returns lowercase plain object from Response', t =>
  withServer(text('x'), async base => {
    const res = await fetch(`${base}/`);
    const h = headers(res);
    t.equal(h['content-type'], 'text/plain; charset=utf-8');
    await asText(res);
  }));

test('headers: returns lowercase plain object from IncomingMessage', t =>
  withServer(text('x'), async base => {
    const im = await getIncomingMessage(`${base}/`);
    const h = headers(im);
    t.equal(h['content-type'], 'text/plain; charset=utf-8');
    await asText(im);
  }));
