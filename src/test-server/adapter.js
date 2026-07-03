import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const encoder = new TextEncoder();

export const toRequest = (req, res) => {
  const scheme = req.scheme || (req.socket && req.socket.encrypted ? 'https' : 'http'),
    authority = req.authority || req.headers.host || 'localhost',
    url = new URL(req.url, scheme + '://' + authority),
    method = req.method.toUpperCase(),
    controller = new AbortController(),
    headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (name[0] == ':' || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.append(name, value);
    }
  }
  const abort = () => res.writableEnded || controller.abort();
  res.on('close', abort);
  // Bun never emits 'close' on the response when the client disconnects
  req.on('aborted', abort);
  const init = {method, headers, signal: controller.signal};
  if (method != 'GET' && method != 'HEAD') {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }
  return new Request(url, init);
};

const isDead = res => res.destroyed || res.writableEnded || !!res.socket?.destroyed;

const waitToDrain = res =>
  new Promise(resolve => {
    const socket = res.socket;
    const done = () => {
      res.off('drain', done);
      res.off('close', done);
      socket?.off('close', done);
      resolve();
    };
    res.on('drain', done);
    res.on('close', done);
    socket?.on('close', done);
  });

export const toChunk = value =>
  value instanceof Uint8Array
    ? value
    : encoder.encode(typeof value == 'string' ? value : JSON.stringify(value) + '\n');

export const writeResponse = async (res, response, method) => {
  const headers = {};
  for (const [name, value] of response.headers) {
    if (name != 'set-cookie') headers[name] = value;
  }
  const cookies = response.headers.getSetCookie?.();
  if (cookies && cookies.length) headers['set-cookie'] = cookies;
  if (response.statusText && !res.stream) {
    // statusText goes out on h1 only: the h2 compat API has no reason phrases
    res.writeHead(response.status, response.statusText, headers);
  } else {
    res.writeHead(response.status, headers);
  }
  if (method == 'HEAD' || !response.body) {
    res.end();
    if (response.body) response.body.cancel().catch(() => {});
    return response.status;
  }
  res.flushHeaders?.();
  try {
    await pipeline(Readable.fromWeb(response.body), res);
  } catch {
    // headers are out — the wire cannot carry an error anymore
    res.destroy();
  }
  return response.status;
};

export const writeIterable = async (res, iterable, method) => {
  const it = iterable[Symbol.asyncIterator]?.() || iterable[Symbol.iterator]();
  let step = await it.next();
  const isText = step.done || typeof step.value == 'string' || step.value instanceof Uint8Array;
  res.writeHead(200, {
    'content-type': isText ? 'text/plain; charset=utf-8' : 'application/x-ndjson'
  });
  if (method == 'HEAD') {
    res.end();
    await it.return?.();
    return 200;
  }
  res.flushHeaders?.();
  try {
    while (!step.done) {
      if (isDead(res)) {
        await it.return?.();
        break;
      }
      if (!res.write(toChunk(step.value))) await waitToDrain(res);
      step = await it.next();
    }
    if (!isDead(res)) res.end();
  } catch {
    res.destroy();
  }
  return 200;
};

export const respondWith = async (res, result, method) => {
  if (result === undefined || result === null) return undefined;
  if (result instanceof Response) return writeResponse(res, result, method);
  if (typeof result == 'string' || result instanceof Uint8Array)
    return writeIterable(res, [result], method);
  if (typeof result == 'object' && (Symbol.asyncIterator in result || Symbol.iterator in result))
    return writeIterable(res, result, method);
  throw TypeError(
    'handler returned an unsupported value: expected Response, (async) iterable, or undefined'
  );
};
