import path from 'node:path';
import {pathToFileURL} from 'node:url';

const isGeneratorFunction = fn => {
  const tag = fn && fn[Symbol.toStringTag];
  return tag === 'GeneratorFunction' || tag === 'AsyncGeneratorFunction';
};

const isHandlerRecord = value =>
  value &&
  typeof value == 'object' &&
  (typeof value.fetch == 'function' || typeof value.raw == 'function');

const isHandlerResult = value =>
  value instanceof Response ||
  typeof value == 'string' ||
  value instanceof Uint8Array ||
  (value &&
    typeof value == 'object' &&
    (Symbol.asyncIterator in value || Symbol.iterator in value));

const fnName = fn => (typeof fn == 'function' && fn.name && fn.name != 'default' ? fn.name : '');

const baseName = specifier => path.basename(specifier).replace(/\.[^.]*$/, '');

let importCounter = 0;

export class PluginRegistry {
  constructor(api) {
    this.api = api;
    this.plugins = [];
    this.anonymousCounter = 0;
  }

  async importModule(specifier, remote) {
    const resolved = path.resolve(this.api.rootFolder, specifier);
    if (remote) {
      const relative = path.relative(this.api.rootFolder, resolved);
      if (relative == '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
        throw Object.assign(Error('plugin module must stay inside the root folder: ' + specifier), {
          code: 'TAPE6_PLUGIN_OUTSIDE_ROOT'
        });
      }
    }
    const url = pathToFileURL(resolved);
    // cache-bust wire registrations so watch-mode re-PUTs load the edited module
    if (remote)
      url.searchParams.set('t', Date.now().toString(36) + '-' + (++importCounter).toString(36));
    const module = await import(url.href);
    if (!('default' in module))
      throw Error('plugin module must have a default export: ' + specifier);
    return module.default;
  }

  async normalize(exported, options, providedName, moduleName) {
    let record = null;
    if (isHandlerRecord(exported)) {
      record = exported;
    } else if (typeof exported == 'function') {
      if (isGeneratorFunction(exported)) {
        record = {fetch: exported};
      } else {
        const result = await exported(this.api, options);
        if (isHandlerRecord(result)) {
          record = result;
        } else if (typeof result == 'function') {
          record = {fetch: result};
        } else if (isHandlerResult(result)) {
          // the export was a bare handler, not a factory — the probe result is discarded
          record = {fetch: exported};
        } else {
          throw Error('plugin factory must return a handler record with fetch() or raw()');
        }
      }
    } else {
      throw Error(
        'unsupported plugin: expected a factory, a handler record, or a generator function'
      );
    }
    const name =
      record.name ||
      providedName ||
      moduleName ||
      fnName(exported) ||
      'plugin-' + ++this.anonymousCounter;
    let prefix = record.prefix || '';
    if (prefix && prefix[0] != '/') prefix = '/' + prefix;
    return {name, prefix, fetch: record.fetch, raw: record.raw, close: record.close};
  }

  async register(spec, {source = 'static', remote = false} = {}) {
    let exported = spec,
      options,
      providedName = '',
      moduleName = '';
    if (typeof spec == 'string') {
      moduleName = baseName(spec);
      exported = await this.importModule(spec, remote);
    } else if (spec && typeof spec == 'object' && typeof spec.module == 'string') {
      options = spec.options;
      providedName = spec.name || '';
      moduleName = baseName(spec.module);
      exported = await this.importModule(spec.module, remote);
    }
    const entry = await this.normalize(exported, options, providedName, moduleName);
    entry.source = source;
    await this.deregister(entry.name);
    this.plugins.push(entry);
    this.plugins.sort((a, b) => b.prefix.length - a.prefix.length);
    return {name: entry.name, prefix: entry.prefix, source};
  }

  async deregister(name) {
    const index = this.plugins.findIndex(plugin => plugin.name === name);
    if (index < 0) return false;
    const [entry] = this.plugins.splice(index, 1);
    try {
      await entry.close?.();
    } catch (error) {
      this.api.log('plugin "' + name + '" failed to close: ' + ((error && error.message) || error));
    }
    return true;
  }

  find(pathname) {
    return this.plugins.filter(plugin => !plugin.prefix || pathname.startsWith(plugin.prefix));
  }

  list() {
    return this.plugins.map(({name, prefix, source}) => ({name, prefix, source}));
  }

  async closeAll() {
    const entries = this.plugins.splice(0).reverse();
    for (const entry of entries) {
      try {
        await entry.close?.();
      } catch {
        // teardown is best-effort
      }
    }
  }
}
