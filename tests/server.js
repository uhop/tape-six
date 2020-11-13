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
  rootFolder = process.cwd(), // path.join(path.dirname(import.meta.url.substr(7)), '..'),
  traceCalls = process.argv.includes('--trace');

mimeTable.mjs = mimeTable.cjs = mimeTable.js;
mimeTable.htm = mimeTable.html;
mimeTable.jpeg = mimeTable.jpg;

// listing

const notSep = '[^\\' + path.sep + ']*';

const sanitizeRe = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const prepRe = (string, separator, substitute) => string.split(separator).map(sanitizeRe).join(substitute);
const mergeWildcards = folders => folders.reduce((acc, part) => ((part || (acc.length && acc[acc.length - 1])) && acc.push(part), acc), []);

const listFiles = async (folders, baseRe, parents) => {
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
        result = result.concat(await listFiles(theRest, baseRe, parents.concat(file.name)));
      }
    }
    return result;
  }

  result = result.concat(await listFiles(theRest, baseRe, parents));
  for (const file of files) {
    if (file.isDirectory()) {
      result = result.concat(await listFiles(folders, baseRe, parents.concat(file.name)));
    }
  }
  return result;
};

const getListing = async wildcard => {
  const parsed = path.parse(wildcard),
    baseRe = new RegExp('^' + prepRe(parsed.name, '*', notSep) + prepRe(parsed.ext, '*', notSep) + '$'),
    folders = mergeWildcards(
      parsed.dir
        .split(path.sep)
        .filter(part => part)
        .map(part => (part === '**' ? null : new RegExp('^' + prepRe(part, '*', notSep) + '$')))
    );
  return listFiles(folders, baseRe, []);
};

// sending helpers

const sendFile = (res, fileName, ext, justHeaders) => {
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
};

const sendJson = (res, json, justHeaders) => {
  res.writeHead(200, {'Content-Type': 'application/json'});
  if (justHeaders) {
    res.end();
  } else {
    res.end(JSON.stringify(json));
  }
};

const bailOut = (res, code = 404) => {
  res.writeHead(code).end();
  traceCalls && console.log('-', code);
};

// server

const server = http.createServer(async (req, res) => {
  traceCalls && console.log(req.method, req.url);

  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return bailOut(res, 405);

  const url = new URL(req.url, 'http://' + req.headers.host);
  if (url.pathname === '/--ls') {
    // process listing
    return sendJson(res, await getListing(url.searchParams.get('q')), method === 'HEAD');
  }

  const fileName = path.join(rootFolder, url.pathname);
  if (fileName.includes('..')) return bailOut(res, 403);

  const ext = path.extname(fileName).toLowerCase(),
    stat = await fsp.stat(fileName).catch(() => null);
  if (stat && stat.isFile()) return sendFile(res, fileName, ext, method === 'HEAD');

  if (ext) return bailOut(res);

  if (stat && stat.isDirectory()) {
    if (fileName.length && fileName[fileName.length - 1] == path.sep) {
      const altFile = path.join(fileName, 'index.html'),
        stat = await fsp.stat(altFile).catch(() => null);
      if (stat && stat.isFile()) return sendFile(res, altFile, '.html', method === 'HEAD');
    }
    return bailOut(res);
  }

  if (fileName.length && fileName[fileName.length - 1] != path.sep) {
    const altFile = fileName + '.html',
      stat = await fsp.stat(altFile).catch(() => null);
    if (stat && stat.isFile()) return sendFile(res, altFile, '.html', method === 'HEAD');
  }

  bailOut(res);
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
      console.error('Error: ' + bind + ' requires elevated privileges');
      process.exit(1);
    case 'EADDRINUSE':
      console.error('Error: ' + bind + ' is already in use');
      process.exit(1);
  }
  throw error;
});

server.on('listening', () => {
  //const addr = server.address();
  const bind = portToString(port);
  console.log('Listening on ' + (host || 'all network interfaces') + ' ' + bind + ', serving static files from ' + rootFolder);
});
