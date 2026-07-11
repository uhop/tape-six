// @ts-self-types="./bootstrap.d.ts"

// The in-page half of the browser-worker contract lives here: index.js talks
// back through __tape6_reporter / __tape6_error / __tape6_reportResults, and
// the iframe transport listens for the tape6-terminate message.

export const supportedTestFileRe = /\.(?:js|mjs|htm|html)$/i;

export const iframeId = id => 'test-iframe-' + id;

export const terminateMessage = reason => ({type: 'tape6-terminate', reason});

export const htmlTestUrl = (fileName, {id, flags = ''} = {}) => {
  const search = new URLSearchParams({id, 'test-file-name': fileName});
  if (flags) search.set('flags', flags);
  return '/' + fileName + '?' + search.toString();
};

export const testPageSrcdoc = (fileName, {id, flags = '', importmap = null} = {}) =>
  '<!doctype html>' +
  '<html lang="en"><head>' +
  '<meta charset="utf-8" />' +
  (importmap ? '<script type="importmap">' + JSON.stringify(importmap) + '<\/script>' : '') +
  '<script type="module">' +
  'window.__tape6_id = ' +
  JSON.stringify(id) +
  ';' +
  'window.__tape6_testFileName = ' +
  JSON.stringify(fileName) +
  ';' +
  'window.__tape6_flags = ' +
  JSON.stringify(flags) +
  ';' +
  'const s = document.createElement("script");' +
  's.setAttribute("type", "module");' +
  's.src = "/' +
  fileName +
  '";' +
  's.onerror = error => window.parent.__tape6_error(' +
  JSON.stringify(id) +
  ', error && error.message || "Script load error");' +
  'document.documentElement.appendChild(s);' +
  '<\/script>' +
  '</head><body></body></html>';
