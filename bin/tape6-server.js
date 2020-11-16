#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';

const fsp = fs.promises;

// simple static server with no dependencies

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
  isTTY = process.stdout.isTTY,
  hasColors = isTTY && process.stdout.hasColors();

let webAppRoot = process.env.WEBAPP_ROOT;
if (!webAppRoot) {
  const url = import.meta.url;
  if (!/^file:\/\//i.test(url)) throw Error('Cannot identify the location of the web application. Use WEBAPP_PATH.');
  webAppRoot = path.join(path.dirname(url.substr(7)), '../webApp/');
}

// common aliases
const mimeAliases = {mjs: 'js', cjs: 'js', htm: 'html', jpeg: 'jpg'};
Object.keys(mimeAliases).forEach(name => (mimeTable[name] = mimeTable[mimeAliases[name]]));

// colors to use
const join = (...args) => args.map(value => value || '').join(''),
  paint = hasColors ? (prefix, suffix = '\x1B[39m') => text => join(prefix, text, suffix) : () => text => text,
  grey = paint('\x1B[2;37m', '\x1B[22;39m'),
  red = paint('\x1B[41;97m', '\x1B[49;39m'),
  green = paint('\x1B[32m'),
  yellow = paint('\x1B[93m'),
  blue = paint('\x1B[44;97m', '\x1B[49;39m');

// listing

const notSep = '[^\\' + path.sep + ']*',
  notDotSep = '[^\\.\\' + path.sep + ']*';

const sanitizeRe = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const prepRe = (string, substitute, allowDot) => {
  const parts = string.split('*'),
    startsWithStar = !parts[0],
    result = parts.map(sanitizeRe).join(substitute);
  return startsWithStar && allowDot ? result : notDotSep + result;
};
const mergeWildcards = folders => folders.reduce((acc, part) => ((part || !acc.length || acc[acc.length - 1]) && acc.push(part), acc), []);

const listFiles = async (rootFolder, folders, baseRe, parents) => {
  const dir = path.join(rootFolder, parents.join(path.sep)),
    files = await fsp.readdir(dir, {withFileTypes: true});

  let result = [];

  if (!folders.length) {
    for (const file of files) {
      if (file.isFile() && baseRe.test(file.name)) result.push(path.join(dir, file.name));
    }
    return result;
  }

  const theRest = folders.slice(1);

  if (folders[0]) {
    for (const file of files) {
      if (file.isDirectory() && folders[0].test(file.name)) {
        result = result.concat(await listFiles(rootFolder, theRest, baseRe, parents.concat(file.name)));
      }
    }
    return result;
  }

  result = result.concat(await listFiles(rootFolder, theRest, baseRe, parents));
  for (const file of files) {
    if (file.isDirectory()) {
      result = result.concat(await listFiles(rootFolder, folders, baseRe, parents.concat(file.name)));
    }
  }
  return result;
};

const listing = async (rootFolder, wildcard) => {
  const parsed = path.parse(wildcard),
    baseRe = new RegExp('^' + prepRe(parsed.name, '.*') + prepRe(parsed.ext, '.*', true) + '$'),
    folders = mergeWildcards(
      parsed.dir
        .split(path.sep)
        .filter(part => part)
        .map(part => (part === '**' ? null : new RegExp('^' + prepRe(part, notSep) + '$')))
    );
  return listFiles(rootFolder, folders, baseRe, []);
};

// sending helpers

const sendFile = (req, res, fileName, ext, justHeaders) => {
  if (!ext) {
    ext = path.extname(fileName).toLowerCase();
  }
  let mime = ext && mimeTable[ext.substr(1)];
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
  if (url.pathname === '/--ls') {
    // process listing
    return sendJson(req, res, await listing(rootFolder, url.searchParams.get('q')), method === 'HEAD');
  }
  if (url.pathname === '/' || url.pathname === '/index' || url.pathname === '/index.html') {
    // redirect to the web app
    return sendRedirect(req, res, '/webApp/index.html');
  }

  if (path.normalize(url.pathname).includes('..')) return bailOut(req, res, 403);

  let fileName = path.join(rootFolder, url.pathname);
  if (url.pathname.substr(0, 8) == '/webApp/') {
    // substitute
    fileName = path.join(webAppRoot, url.pathname.substr(8));
  }

  const ext = path.extname(fileName).toLowerCase(),
    stat = await fsp.stat(fileName).catch(() => null);
  if (stat && stat.isFile()) return sendFile(req, res, fileName, ext, method === 'HEAD');

  if (ext) return bailOut(req, res);

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

  if (fileName.length && fileName[fileName.length - 1] != path.sep) {
    const altFile = fileName + '.html',
      stat = await fsp.stat(altFile).catch(() => null);
    if (stat && stat.isFile()) return sendFile(req, res, altFile, '.html', method === 'HEAD');
  }

  bailOut(req, res);
});

server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) return;
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
