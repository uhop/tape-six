import test from '../index.js';
import {
  htmlTestUrl,
  iframeId,
  supportedTestFileRe,
  terminateMessage,
  testPageSrcdoc
} from '../src/driver/bootstrap.js';

test('supportedTestFileRe gates browser-runnable files', t => {
  for (const name of ['a.js', 'a.mjs', 'a.htm', 'a.html', 'A.HTML']) {
    t.ok(supportedTestFileRe.test(name), name + ' is supported');
  }
  for (const name of ['a.txt', 'a.ts', 'a.cjs', 'a']) {
    t.notOk(supportedTestFileRe.test(name), name + ' is rejected');
  }
});

test('iframeId and terminateMessage shapes', t => {
  t.equal(iframeId('7'), 'test-iframe-7');
  t.deepEqual(terminateMessage('failOnce'), {type: 'tape6-terminate', reason: 'failOnce'});
});

test('htmlTestUrl carries id, file name, and flags', t => {
  const url = htmlTestUrl('tests/browser/test-a.html', {id: '3', flags: 'FO'});
  t.matchString(url, /^\/tests\/browser\/test-a\.html\?/);
  const search = new URLSearchParams(url.split('?')[1]);
  t.equal(search.get('id'), '3');
  t.equal(search.get('test-file-name'), 'tests/browser/test-a.html');
  t.equal(search.get('flags'), 'FO');
  t.notOk(htmlTestUrl('x.html', {id: '1'}).includes('flags='), 'no flags key when empty');
});

test('testPageSrcdoc builds the loader page', t => {
  const importmap = {imports: {'tape-six': '../index.js'}};
  const html = testPageSrcdoc('tests/test-a.js', {id: '5', flags: 'FO', importmap});
  t.matchString(html, /<script type="importmap">/);
  t.ok(html.includes(JSON.stringify(importmap)), 'importmap is embedded');
  t.ok(html.includes('window.__tape6_id = "5";'), 'task id global');
  t.ok(html.includes('window.__tape6_testFileName = "tests/test-a.js";'), 'file name global');
  t.ok(html.includes('window.__tape6_flags = "FO";'), 'flags global');
  t.ok(html.includes('s.src = "/tests/test-a.js";'), 'module loader source');
  t.matchString(html, /__tape6_error/, 'load-error wiring');
  t.notOk(
    testPageSrcdoc('a.js', {id: '1'}).includes('importmap'),
    'no importmap block when absent'
  );
});
