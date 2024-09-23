#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {getConfig, resolveTests, resolvePatterns} from '../src/utils/config.js';

const fsp = fs.promises;

// simple static server with no dependencies

const showSelf = () => {
  const self = new URL(import.meta.url);
  if (self.protocol === 'file:') {
    console.log(fileURLToPath(self));
  } else {
    console.log(self);
  }
  process.exit(0);
};
if (process.argv.includes('--self')) showSelf();

// MIME source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
const mimeTable = {
    css: 'text/css',
    csv: 'text/csv',
    eot: 'application/vnd.ms-fontobject',
    gif: 'image/gif',
    html: 'text/html',
    ico: 'image/vnd.microsoft.icon',
    jpg: 'image/jpeg',
    js: 'text/javascript',
    json: 'application/json',
    otf: 'font/otf',
    png: 'image/png',
    svg: 'image/svg+xml',
    ttf: 'font/ttf',
    txt: 'text/plain',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    xml: 'application/xml'
  },
  defaultMime = 'application/octet-stream',
  rootFolder = process.env.SERVER_ROOT || process.cwd(),
  traceCalls = process.argv.includes('--trace'),
  hasColors =
    process.stdout.isTTY &&
    (typeof process.stdout.hasColors == 'function' ? process.stdout.hasColors() : true);

let webAppPath = process.env.WEBAPP_PATH;
if (!webAppPath) {
  const url = import.meta.url;
  if (!/^file:\/\//i.test(url))
    throw Error('Cannot identify the location of the web application. Use WEBAPP_PATH.');
  const isWindows = path.sep === '\\';
  webAppPath = path.relative(
    rootFolder,
    path.join(path.dirname(fileURLToPath(url)), '../web-app/')
  );
}

// common aliases
const mimeAliases = {mjs: 'js', cjs: 'js', htm: 'html', jpeg: 'jpg'};
Object.keys(mimeAliases).forEach(name => (mimeTable[name] = mimeTable[mimeAliases[name]]));

// colors to use
const join = (...args) => args.map(value => value || '').join(''),
  paint = hasColors
    ? (prefix, suffix = '\x1B[39m') =>
        text =>
          join(prefix, text, suffix)
    : () => text => text,
  grey = paint('\x1B[2;37m', '\x1B[22;39m'),
  red = paint('\x1B[41;97m', '\x1B[49;39m'),
  green = paint('\x1B[32m'),
  yellow = paint('\x1B[93m'),
  blue = paint('\x1B[44;97m', '\x1B[49;39m');

// sending helpers

const sendFile = (req, res, fileName, ext, justHeaders) => {
  if (!ext) {
    ext = path.extname(fileName).toLowerCase();
  }
  let mime = ext && mimeTable[ext.substring(1)];
  if (!mime || typeof mime != 'string') {
    mime = defaultMime;
  }
  res.writeHead(200, {'Content-Type': mime});
  if (justHeaders) {
    res.end();
  } else {
    fs.createReadStream(fileName).pipe(res);
  }
  traceCalls && console.log(green('200') + ' ' + grey(req.method) + ' ' + grey(req.url));
};

const sendJson = (req, res, json, justHeaders) => {
  res.writeHead(200, {'Content-Type': 'application/json'});
  if (justHeaders) {
    res.end();
  } else {
    res.end(JSON.stringify(json));
  }
  traceCalls && console.log(green('200') + ' ' + grey(req.method) + ' ' + grey(req.url));
};

const sendRedirect = (req, res, to, code = 301) => {
  res.writeHead(code, {Location: to});
  res.end();
  traceCalls && console.log(blue(code) + ' ' + grey(req.method) + ' ' + grey(req.url));
};

const bailOut = (req, res, code = 404) => {
  res.writeHead(code).end();
  traceCalls && console.log(red(code) + ' ' + grey(req.method) + ' ' + grey(req.url));
};

// server

const server = http.createServer(async (req, res) => {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return bailOut(req, res, 405);

  const url = new URL(req.url, 'http://' + req.headers.host);
  if (url.pathname === '/--tests') {
    // get tests
    return sendJson(req, res, await resolveTests(rootFolder, 'browser'), method === 'HEAD');
  }
  if (url.pathname === '/--patterns') {
    // resolve patterns
    return sendJson(
      req,
      res,
      await resolvePatterns(rootFolder, url.searchParams.getAll('q')),
      method === 'HEAD'
    );
  }
  if (url.pathname === '/--importmap') {
    // get import map contents
    const cfg = await getConfig(rootFolder);
    return sendJson(req, res, cfg.importmap || {imports: {}}, method === 'HEAD');
  }
  if (url.pathname === '/' || url.pathname === '/index' || url.pathname === '/index.html') {
    // redirect to the web app
    url.pathname = webAppPath;
    return sendRedirect(req, res, url.href);
  }

  if (path.normalize(url.pathname).includes('..')) return bailOut(req, res, 403);

  const fileName = path.join(rootFolder, url.pathname),
    ext = path.extname(fileName).toLowerCase(),
    stat = await fsp.stat(fileName).catch(() => null);
  if (stat && stat.isFile()) return sendFile(req, res, fileName, ext, method === 'HEAD');

  if (stat && stat.isDirectory()) {
    if (fileName.length && fileName[fileName.length - 1] == path.sep) {
      const altFile = path.join(fileName, 'index.html'),
        stat = await fsp.stat(altFile).catch(() => null);
      if (stat && stat.isFile()) return sendFile(req, res, altFile, '.html', method === 'HEAD');
    } else {
      url.pathname += path.sep;
      return sendRedirect(req, res, url.href);
    }
    return bailOut(req, res);
  }

  if (!ext && fileName.length && fileName[fileName.length - 1] != path.sep) {
    const altFile = fileName + '.html',
      stat = await fsp.stat(altFile).catch(() => null);
    if (stat && stat.isFile()) return sendFile(req, res, altFile, '.html', method === 'HEAD');
  }

  bailOut(req, res);
});

server.on('clientError', (error, socket) => {
  if (error.code === 'ECONNRESET' || !socket.writable) return;
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// general setup

const normalizePort = val => {
  const port = parseInt(val);
  if (isNaN(port)) return val; // named pipe
  if (port >= 0) return port; // port number
  return false;
};

const portToString = port => (typeof port === 'string' ? 'pipe' : 'port') + ' ' + port;

const host = process.env.HOST || 'localhost',
  port = normalizePort(process.env.PORT || '3000');

server.listen(port, host);

server.on('error', error => {
  if (error.syscall !== 'listen') throw error;
  const bind = portToString(port);
  switch (error.code) {
    case 'EACCES':
      console.log(red('Error: ') + yellow(bind) + red(' requires elevated privileges') + '\n');
      process.exit(1);
    case 'EADDRINUSE':
      console.log(red('Error: ') + yellow(bind) + red(' is already in use') + '\n');
      process.exit(1);
  }
  throw error;
});

server.on('listening', () => {
  //const addr = server.address();
  const bind = portToString(port);
  console.log(
    grey('Listening on ') +
      yellow(host || 'all network interfaces') +
      grey(' at ') +
      yellow(bind) +
      grey(', serving static files from ') +
      yellow(rootFolder) +
      '\n'
  );
});
