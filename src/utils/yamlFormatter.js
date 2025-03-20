const defaultOptions = {offset: 0, levelOffset: 2, string: ' ', maxDepth: 5};

const repeatString = (n, string = ' ') => {
  let acc = '',
    buffer = string;
  for (; n > 0; n >>= 1, buffer += buffer) {
    n & 1 && (acc += buffer);
  }
  return acc;
};

const hasNewline = /\n/,
  hasColon = /:/,
  forceQuotes = /^(?:@|`|\s|$|true$|false$|null$|.+\s$)/;

const getDataEncoding = value => {
  switch (typeof value) {
    case 'string':
      if (hasNewline.test(value)) return {inline: true, string: value.split('\n')};
      if (forceQuotes.test(value)) return {inline: true, string: '"' + value + '"'};
      if (!isNaN(value)) return {inline: true, string: '"' + value + '"'};
      {
        const encoded = JSON.stringify(value);
        if (value.length + 2 === encoded.length) return {inline: true, string: value};
        return {inline: true, string: encoded};
      }
    case 'boolean':
      return {inline: true, string: String(value)};
    case 'number':
      if (value === Infinity) return {inline: true, string: '.inf'};
      if (value === -Infinity) return {inline: true, string: '-.inf'};
      if (isNaN(value)) return {inline: true, string: '.nan'};
      return {inline: true, string: String(value)};
    case 'object':
      break;
    default:
      return {skip: true};
  }
  if (value === null) return {inline: true, string: 'null'};
  if (value instanceof Date) return {inline: true, string: value.toUTCString()};
  if (value instanceof Set || value instanceof Map) return {skip: true};
  if (Array.isArray(value) && !value.length) return {inline: true, string: '[]'};
  const keys = Object.keys(value);
  if (!keys.length) return {inline: true, string: '{}'};
  return {};
};

const getKeyEncoding = key => {
  if (forceQuotes.test(key)) return {string: '"' + key + '"'};
  if (hasNewline.test(key)) return {string: key.split('\n')};
  const encoded = JSON.stringify(key);
  if (key.length + 2 === encoded.length) {
    if (hasColon.test(key)) return {string: key};
    return {inline: true, string: key};
  }
  return {inline: true, string: encoded};
};

const format = (value, options, level, offset, lines) => {
  if (level > options.maxDepth) return;
  const result = getDataEncoding(value);
  if (result.skip) return;
  if (result.inline) {
    if (typeof result.string == 'string') {
      lines.push(offset + result.string);
      return;
    }
    lines.push(offset + '|+');
    offset += options.levelOffset;
    result.string.forEach(line => lines.push(offset + line));
    return;
  }

  // array
  if (Array.isArray(value)) {
    if (level + 1 > options.maxDepth) {
      lines.push(offset + '[]');
      return;
    }
    value.forEach(v => {
      const valueResult = getDataEncoding(v);
      if (valueResult.skip) return;
      if (valueResult.inline) {
        if (typeof valueResult.string == 'string') {
          lines.push(offset + '- ' + valueResult.string);
          return;
        }
        lines.push(offset + '- |+');
        const nextOffset = offset + options.levelOffset;
        valueResult.string.forEach(line => lines.push(nextOffset + line));
        return;
      }
      lines.push(offset + '-');
      format(v, options, level + 1, offset + options.levelOffset, lines);
    });
    return;
  }

  // regular object
  if (level + 1 > options.maxDepth) {
    lines.push(offset + '{}');
    return;
  }
  for (let k in value) {
    const v = value[k],
      valueResult = getDataEncoding(v);
    if (valueResult.skip) continue;
    const keyResult = getKeyEncoding(k);
    if (!keyResult.inline) {
      if (typeof keyResult.string == 'string') {
        lines.push(offset + '? ' + keyResult.string);
      } else {
        lines.push(offset + '? |+');
        const nextOffset = offset + options.levelOffset;
        keyResult.string.forEach(line => lines.push(nextOffset + line));
      }
    }
    const key = keyResult.inline ? keyResult.string : '';
    if (valueResult.inline) {
      if (typeof valueResult.string == 'string') {
        lines.push(offset + key + ': ' + valueResult.string);
        continue;
      }
      lines.push(offset + key + ': |+');
      const nextOffset = offset + options.levelOffset;
      valueResult.string.forEach(line => lines.push(nextOffset + line));
      continue;
    }
    lines.push(offset + key + ':');
    format(v, options, level + 1, offset + options.levelOffset, lines);
  }
};

const yamlFormatter = (object, options) => {
  options = {...defaultOptions, ...options};
  const lines = [],
    string = options.string || ' ',
    offset =
      !isNaN(options.offset) && options.offset > 0
        ? repeatString(options.offset, string)
        : typeof options.offset == 'string'
          ? options.offset
          : '',
    levelOffset =
      !isNaN(options.levelOffset) && options.levelOffset > 0
        ? repeatString(options.levelOffset, string)
        : typeof options.levelOffset == 'string'
          ? options.levelOffset
          : '',
    opts = {levelOffset, maxDepth: options.maxDepth};
  format(object, opts, 0, offset, lines);
  return lines;
};

export default yamlFormatter;
