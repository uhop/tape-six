export const findEscSequence =
  /\x1B(?:\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]|[\x20-\x2F]*[\x30-\x7E])/g;
export const getLength = str => String(str).replace(findEscSequence, '').length;

export const normalizeBox = (strings, symbol = ' ', align = 'right') => {
  const maxLength = strings.reduce((acc, s) => Math.max(acc, getLength(s)), 0);
  return strings.map(s => {
    const padding = symbol.repeat(maxLength - getLength(s));
    switch (align) {
      case 'left':
        return padding + s;
      case 'center':
        const half = padding.length >> 1;
        return padding.substring(0, half) + s + padding.substring(half);
    }
    return s + padding;
  });
};

export const padBoxRight = (strings, n, symbol = ' ') => {
  const padding = symbol.repeat(n);
  return strings.map(s => s + padding);
};

export const padBoxLeft = (strings, n, symbol = ' ') => {
  const padding = symbol.repeat(n);
  return strings.map(s => padding + s);
};

export const padBoxTop = (strings, n, symbol = ' ') => {
  const string = symbol.repeat(getLength(strings[0])),
    result = [];
  for (; n > 0; --n) result.push(string);
  strings.forEach(s => result.push(s));
  return result;
};

export const padBoxBottom = (strings, n, symbol = ' ') => {
  const string = symbol.repeat(getLength(strings[strings.length - 1])),
    result = [...strings];
  for (; n > 0; --n) result.push(string);
  return result;
};

export const padBox = (strings, t, r, b, l, symbol) => {
  if (typeof r != 'number') {
    symbol = r;
    r = b = l = t;
  } else if (typeof b != 'number') {
    symbol = b;
    l = r;
    b = t;
  } else if (typeof l != 'number') {
    symbol = l;
    l = r;
  }
  if (typeof symbol != 'string') symbol = ' ';
  if (t > 0) strings = padBoxTop(strings, t, symbol);
  if (b > 0) strings = padBoxBottom(strings, b, symbol);
  if (r > 0) strings = padBoxRight(strings, r, symbol);
  if (l > 0) strings = padBoxLeft(strings, l, symbol);
  return strings;
};

export const drawBox = strings => {
  const maxLength = strings.reduce((acc, s) => Math.max(acc, getLength(s)), 0),
    line = '\u2500'.repeat(maxLength),
    result = ['\u256D' + line + '\u256E'];
  strings.forEach(s => result.push('\u2502' + s + '\u2502'));
  result.push('\u2570' + line + '\u256F');
  return result;
};

export const stackVertically = (a, b) => [...a, ...b];

export const stackHorizontally = (a, b, symbol = ' ') => {
  const n = Math.min(a.length, b.length),
    result = [];
  for (let i = 0; i < n; ++i) result.push(a[i] + b[i]);
  if (a.length < b.length) {
    const maxLength = a.reduce((acc, s) => Math.max(acc, getLength(s)), 0),
      string = symbol.repeat(maxLength);
    for (let i = n; i < b.length; ++i) result.push(string + b[i]);
  } else {
    for (let i = n; i < a.length; ++i) result.push(a[i]);
  }
  return result;
};
