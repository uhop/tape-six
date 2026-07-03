import fs from 'node:fs';
import path from 'node:path';

const fsp = fs.promises;

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
  defaultMime = 'application/octet-stream';

const mimeAliases = {mjs: 'js', cjs: 'js', htm: 'html', jpeg: 'jpg'};
Object.keys(mimeAliases).forEach(name => (mimeTable[name] = mimeTable[mimeAliases[name]]));

export const createStatics = ({rootFolder, webAppPath, trace = () => {}}) => {
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
    trace(200, req);
  };

  const sendRedirect = (req, res, to, code = 307) => {
    res.writeHead(code, {Location: to});
    res.end();
    trace(code, req);
  };

  const bailOut = (req, res, code = 404) => {
    res.writeHead(code).end();
    trace(code, req);
  };

  return async (req, res) => {
    const method = req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return bailOut(req, res, 405);

    const scheme = req.scheme || (req.socket && req.socket.encrypted ? 'https' : 'http'),
      authority = req.authority || req.headers.host || 'localhost',
      url = new URL(req.url, scheme + '://' + authority);

    if (url.pathname === '/favicon.ico') {
      const faviconFile = path.join(rootFolder, webAppPath, 'favicon.ico');
      const stat = await fsp.stat(faviconFile).catch(() => null);
      if (stat && stat.isFile()) return sendFile(req, res, faviconFile, '.ico', method === 'HEAD');
      return bailOut(req, res);
    }
    if (url.pathname === '/' || url.pathname === '/index' || url.pathname === '/index.html') {
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
        url.pathname += path.posix.sep;
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
  };
};
