import path from 'node:path';

import {getConfig, resolvePatterns, resolveTests} from '../utils/config.js';

const toPosix = files =>
  path.sep === path.win32.sep
    ? files.map(f => f.replaceAll(path.win32.sep, path.posix.sep))
    : files;

const readOnly = handler => request =>
  request.method == 'GET' || request.method == 'HEAD'
    ? handler(request)
    : new Response(null, {status: 405, headers: {allow: 'GET, HEAD'}});

export const createControl = ({rootFolder, registry, remotePlugins = true}) => {
  const endpoints = new Map([
    [
      '/--tests',
      readOnly(async () => Response.json(toPosix(await resolveTests(rootFolder, 'browser'))))
    ],
    [
      '/--patterns',
      readOnly(async request => {
        const url = new URL(request.url);
        return Response.json(
          toPosix(await resolvePatterns(rootFolder, url.searchParams.getAll('q')))
        );
      })
    ],
    [
      '/--importmap',
      readOnly(async () => {
        const cfg = await getConfig(rootFolder);
        return Response.json(cfg.importmap || {imports: {}});
      })
    ]
  ]);

  const pluginsEndpoint = async request => {
    const method = request.method,
      pathname = new URL(request.url).pathname,
      rest =
        pathname.length > '/--plugins/'.length
          ? decodeURIComponent(pathname.substring('/--plugins/'.length))
          : '';
    if (method == 'GET' || method == 'HEAD') {
      if (!rest) return Response.json(registry.list());
      const entry = registry.list().find(plugin => plugin.name === rest);
      return entry
        ? Response.json(entry)
        : new Response('unknown plugin: ' + rest + '\n', {status: 404});
    }
    if (!remotePlugins)
      return new Response('remote plugin registration is disabled (--no-remote-plugins)\n', {
        status: 403
      });
    if (method == 'PUT' && !rest) {
      let spec;
      try {
        spec = await request.json();
      } catch {
        return new Response('the body must be valid JSON\n', {status: 400});
      }
      if (!spec || typeof spec != 'object' || typeof spec.module != 'string')
        return new Response(
          'the body must be {"module": "path", "options?": {}, "name?": "..."}\n',
          {
            status: 400
          }
        );
      try {
        return Response.json(await registry.register(spec, {source: 'dynamic', remote: true}));
      } catch (error) {
        const status = error && error.code === 'TAPE6_PLUGIN_OUTSIDE_ROOT' ? 403 : 400;
        return new Response(String((error && error.message) || error) + '\n', {status});
      }
    }
    if (method == 'DELETE' && rest) {
      return (await registry.deregister(rest))
        ? new Response(null, {status: 204})
        : new Response('unknown plugin: ' + rest + '\n', {status: 404});
    }
    return new Response(null, {status: 405, headers: {allow: 'GET, HEAD, PUT, DELETE'}});
  };

  return {
    match: pathname => {
      const endpoint = endpoints.get(pathname);
      if (endpoint) return endpoint;
      if (pathname == '/--plugins' || pathname.startsWith('/--plugins/')) return pluginsEndpoint;
      return null;
    }
  };
};
