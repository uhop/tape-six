const join = (...args) => args.map(value => value || '').join('');

export const detectColors = () =>
  typeof process == 'object' &&
  !!process.stdout &&
  !!process.stdout.isTTY &&
  (typeof process.stdout.hasColors == 'function' ? process.stdout.hasColors() : true);

export const makePaint = hasColors =>
  hasColors
    ? (prefix, suffix = '\x1B[39m') =>
        text =>
          join(prefix, text, suffix)
    : () => text => String(text);

export const makeTrace = ({
  enabled = false,
  log = console.log,
  hasColors = detectColors()
} = {}) => {
  if (!enabled) return () => {};
  const paint = makePaint(hasColors),
    grey = paint('\x1B[2;37m', '\x1B[22;39m'),
    red = paint('\x1B[41;97m', '\x1B[49;39m'),
    green = paint('\x1B[32m'),
    blue = paint('\x1B[44;97m', '\x1B[49;39m');
  return (status, req) => {
    const painted = status < 300 ? green : status < 400 ? blue : red;
    log(painted(String(status)) + ' ' + grey(req.method) + ' ' + grey(req.url));
  };
};
