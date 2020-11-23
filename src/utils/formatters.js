export const formatNumber = (n, precision = 0) => {
  const s = Number(Math.abs(n)).toFixed(precision),
    [i, f] = precision ? s.split('.') : [s];
  if (!f && i.length <= 3) return n < 0 ? '-' + s : s;
  const parts = [];
  let start = i.length % 3;
  start && parts.push(i.substr(0, start));
  for (; start < i.length; start += 3) parts.push(i.substr(start, 3));
  let result = parts.join(',');
  f && !/^0*$/.test(f) && (result += '.' + f.replace(/0+$/, ''));
  return n < 0 ? '-' + result : result;
};

const SEC = 1000,
  MIN = 60 * SEC,
  HOUR = 60 * MIN,
  DAY = 24 * HOUR;

const omit = (value, suffix, expected = '0') => (value === expected ? '' : value + suffix);

export const formatTime = ms => {
  if (ms < 10) return formatNumber(ms, 3) + 'ms';
  if (ms < 100) return formatNumber(ms, 2) + 'ms';
  if (ms < SEC) return formatNumber(ms, 1) + 'ms';
  if (ms < 10000) return formatNumber(ms / SEC, 3) + 's';
  if (ms < MIN) return formatNumber(ms / SEC, 2) + 's';
  if (ms < HOUR) return formatNumber(Math.floor(ms / MIN), 0) + 'm' + omit(formatNumber(Math.floor((ms % MIN) / SEC), 0), 's');
  if (ms < DAY) return formatNumber(Math.floor(ms / HOUR), 0) + 'h' + omit(formatNumber(Math.floor((ms % HOUR) / MIN), 0), 'm');
  return formatNumber(Math.floor(ms / DAY), 0) + 'd' + omit(formatNumber(Math.floor((ms % DAY) / HOUR), 0), 'h');
};
