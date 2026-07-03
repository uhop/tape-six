import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const fsp = fs.promises;
const run = promisify(execFile);

const DAY = 86_400_000;

const isUsable = (pem, host) => {
  try {
    const x509 = new crypto.X509Certificate(pem);
    if (new Date(x509.validTo).getTime() - Date.now() < DAY) return false;
    return !!(net.isIP(host) ? x509.checkIP(host) : x509.checkHost(host));
  } catch {
    return false;
  }
};

export const resolveCerts = async ({cert, key, rootFolder, host = 'localhost', log}) => {
  const certPath = cert || process.env.TAPE6_CERT,
    keyPath = key || process.env.TAPE6_KEY;
  if (certPath || keyPath) {
    if (!certPath || !keyPath)
      throw Error('both the certificate and the key must be provided (TAPE6_CERT + TAPE6_KEY)');
    return {
      cert: await fsp.readFile(path.resolve(rootFolder, certPath)),
      key: await fsp.readFile(path.resolve(rootFolder, keyPath))
    };
  }

  const cacheDir = path.join(rootFolder, 'node_modules', '.cache', 'tape6'),
    cachedCert = path.join(cacheDir, 'cert.pem'),
    cachedKey = path.join(cacheDir, 'key.pem'),
    [oldCert, oldKey] = await Promise.all([
      fsp.readFile(cachedCert).catch(() => null),
      fsp.readFile(cachedKey).catch(() => null)
    ]);
  if (oldCert && oldKey && isUsable(oldCert, host)) return {cert: oldCert, key: oldKey};

  await fsp.mkdir(cacheDir, {recursive: true});
  const sans = new Set(['DNS:localhost', 'IP:127.0.0.1', 'IP:::1']);
  sans.add((net.isIP(host) ? 'IP:' : 'DNS:') + host);
  try {
    await run('openssl', [
      'req',
      '-x509',
      '-newkey',
      'ec',
      '-pkeyopt',
      'ec_paramgen_curve:P-256',
      '-keyout',
      cachedKey,
      '-out',
      cachedCert,
      '-days',
      '365',
      '-nodes',
      '-subj',
      '/CN=tape6-server',
      '-addext',
      'subjectAltName=' + [...sans].join(',')
    ]);
  } catch (error) {
    throw Error(
      'cannot generate a self-signed certificate: ' +
        ((error && error.message) || error) +
        '\nInstall openssl, or provide a certificate via TAPE6_CERT + TAPE6_KEY (e.g. from mkcert).'
    );
  }
  log?.('Generated a self-signed certificate: ' + cachedCert);
  return {cert: await fsp.readFile(cachedCert), key: await fsp.readFile(cachedKey)};
};
