import test from '../../index.js';
import {withServer, record} from '../../src/server.js';

test('record() captures requests with the default responder', async t => {
  const rec = record();
  await withServer(rec, async base => {
    const response = await fetch(base + '/ping?x=1', {headers: {'x-probe': 'yes'}});
    t.equal(response.status, 204, 'default responder answers 204');
    await fetch(base + '/upload', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({a: 1})
    });
  });
  t.equal(rec.requests.length, 2, 'both requests recorded');
  t.match(rec.requests[0], {method: 'GET', url: '/ping?x=1', body: ''});
  t.equal(rec.requests[0].headers['x-probe'], 'yes', 'headers are recorded');
  t.match(rec.requests[1], {method: 'POST', url: '/upload', body: '{"a":1}'});
});

test('record(handler) delegates with the buffered entry', async t => {
  const rec = record((req, res, entry) => {
    res.setHeader('content-type', 'text/plain');
    res.end('len:' + entry.body.length);
  });
  await withServer(rec, async base => {
    const response = await fetch(base + '/echo', {method: 'POST', body: 'hello'});
    t.equal(await response.text(), 'len:5', 'handler saw the buffered body');
  });
  t.equal(rec.requests.length, 1, 'delegated request recorded');
  t.equal(rec.requests[0].body, 'hello');
});

test('record() resets via requests.length', async t => {
  const rec = record();
  await withServer(rec, async base => {
    await fetch(base + '/one');
    rec.requests.length = 0;
    await fetch(base + '/two');
  });
  t.equal(rec.requests.length, 1, 'only post-reset requests remain');
  t.equal(rec.requests[0].url, '/two');
});
