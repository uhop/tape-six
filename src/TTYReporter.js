// utilities

const stringRep = (n, str = ' ') => {
  n = Math.max(0, Math.floor(n));
  if (!n) return '';
  let s = str,
    buffer = '';
  for (;;) {
    n & 1 && (buffer += s);
    n >>= 1;
    if (!n) break;
    s += s;
  }
  return buffer;
};

const join = (...args) => args.reduce((acc, val) => acc + (val || ''), '');

const findEscSequence = /\x1B(?:\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]|[\x20-\x2F]*[\x30-\x7E])/g;
const getLength = str => String(str).replace(findEscSequence, '').length;

const formatNumber = (n, precision = 0) => {
  const s = Number(Math.abs(n)).toFixed(precision),
    [i, f] = precision ? s.split('.') : [s];
  if (i.lenght <= 3) return n < 0 ? '-' + s : s;
  const parts = [];
  let start = i.length % 3;
  start && parts.push(i.substr(0, start));
  for (; start < i.length; start += 3) parts.push(i.substr(start, 3));
  let result = parts.join(',');
  f && !/^0*$/.test(f) && (result += '.' + f.replace(/0+$/, ''));
  return n < 0 ? '-' + result : result;
};

const formatTime = ms => formatNumber(ms, 3) + 'ms';

// colors
const red = text => join('\x1B[31m', text, '\x1B[39m'),
  green = text => join('\x1B[92m', text, '\x1B[39m'),
  blue = text => join('\x1B[94m', text, '\x1B[39m'),
  blackBg = text => join('\x1B[40m', text, '\x1B[49m'),
  lowWhite = text => join('\x1B[2;37m', text, '\x1B[22;39m'),
  brightWhite = text => join('\x1B[1;97m', text, '\x1B[22;39m'),
  warning = text => join('\x1B[41;1;37m', text, '\x1B[22;39;49m'),
  italic = text => join('\x1B[3m', text, '\x1B[23m'),
  reset = '\x1B[0m';

const to6 = x => Math.min(5, Math.round((Math.max(0, Math.min(255, x)) / 255) * 6));
const buildColor = (r, g, b) => 16 + 36 * to6(r) + 6 * to6(g) + to6(b);

// boxes

const normalizeBox = (strings, symbol = ' ', align = 'right') => {
  const maxLength = strings.reduce((acc, s) => Math.max(acc, getLength(s)), 0);
  return strings.map(s => {
    const padding = stringRep(maxLength - getLength(s), symbol);
    switch (align) {
      case 'left':
        return padding + s;
      case 'center':
        const half = padding.length >> 1;
        return padding.substr(0, half) + s + padding.substr(half);
    }
    return s + padding;
  });
};

const padBoxRight = (strings, n, symbol = ' ') => {
  const padding = stringRep(n, symbol);
  return strings.map(s => s + padding);
};
const padBoxLeft = (strings, n, symbol = ' ') => {
  const padding = stringRep(n, symbol);
  return strings.map(s => padding + s);
};
const padBoxTop = (strings, n, symbol = ' ') => {
  const string = stringRep(getLength(strings[0]), symbol),
    result = [];
  for (; n > 0; --n) result.push(string);
  strings.forEach(s => result.push(s));
  return result;
};
const padBoxBottom = (strings, n, symbol = ' ') => {
  const string = stringRep(getLength(strings[strings.length - 1]), symbol),
    result = [...strings];
  for (; n > 0; --n) result.push(string);
  return result;
};

const drawBox = strings => {
  const maxLength = strings.reduce((acc, s) => Math.max(acc, getLength(s)), 0),
    line = stringRep(maxLength, '\u2500'),
    result = ['\u256D' + line + '\u256E'];
  strings.forEach(s => result.push('\u2502' + s + '\u2502'));
  result.push('\u2570' + line + '\u256F');
  return result;
};

const stackVertically = (a, b) => [...a, ...b];
const stackHorizontally = (a, b, symbol = ' ') => {
  const n = Math.min(a.length, b.length),
    result = [];
  for (let i = 0; i < n; ++i) result.push(a[i] + b[i]);
  if (a.length < b.length) {
    const maxLength = a.reduce((acc, s) => Math.max(acc, getLength(s)), 0),
      string = stringRep(maxLength, symbol);
    for (let i = n; i < b.length; ++i) result.push(string + b[i]);
  } else {
    for (let i = n; i < a.length; ++i) result.push(a[i]);
  }
  return result;
};

// main

class TTYReporter {
  constructor({output = process.stdout, renumberAsserts = false, failureOnly = false, short = false, summary = true, hideTime = false} = {}) {
    if (!output || !output.isTTY) throw Error('Module TTYReporter works only with TTY output streams.');

    this.output = output;
    this.renumberAsserts = renumberAsserts;
    this.failureOnly = failureOnly;
    this.short = short;
    this.summary = summary;
    this.hideTime = hideTime;
    this.depth = 0;
    this.assertCounter = 0;
  }
  out(text) {
    if (this.depth < 2) {
      this.output.write(text + '\n');
    } else {
      this.output.write(stringRep(this.depth - 1, '  ') + text + '\n');
    }
    return this;
  }
  report(event) {
    let text;
    switch (event.type) {
      case 'test':
        this.depth && this.out('- ' + (event.name || 'anonymous test'));
        ++this.depth;
        break;
      case 'comment':
        !this.short && this.out(blue(italic(event.name || 'empty comment')));
        break;
      case 'end':
        if (--this.depth) {
          // this.output.moveCursor(0, -1);
          // this.output.clearLine(0);
          text = (event.fail ? '✗' : '✓') + ' ' + (event.name || 'anonymous test');
          text = (event.fail ? red : green)(text);
          !this.hideTime && (text += lowWhite(' - ' + formatTime(event.diffTime)));
          this.out(text);
          break;
        }
        // summary
        const state = event.data,
          success = state.asserts - state.failed - state.skipped;

        const paintColor = `\x1B[48;5;${event.fail ? buildColor(64, 0, 0) : buildColor(0, 32, 0)};1;97m`;
        let box1 = ['Summary: ' + (event.fail ? 'fail' : 'pass')];
        box1 = padBoxLeft(box1, 2);
        box1 = padBoxRight(box1, 2);
        box1 = drawBox(box1);
        box1 = padBoxLeft(box1, 3);
        box1 = padBoxRight(box1, 3);
        box1 = normalizeBox(
          [...box1, '', 'Passed: ' + (event.fail ? formatNumber((success / state.asserts) * 100, 1) + '%' : '100%')],
          ' ',
          'center'
        );
        box1 = padBoxTop(box1, 1);
        box1 = padBoxBottom(box1, 1);
        box1 = box1.map(s => join(paintColor, s, reset));
        box1 = padBoxLeft(box1, 2);

        let box2 = normalizeBox(
          [formatNumber(state.asserts), formatNumber(state.skipped), formatNumber(success), formatNumber(state.failed), formatTime(event.diffTime)],
          ' ',
          'left'
        );
        box2 = padBoxLeft(box2, 1);
        box2 = stackHorizontally(normalizeBox(['tests:', 'skipped:', 'passed:', 'failed:', 'time:']), box2);

        box2[0] = brightWhite(box2[0]);
        box2[1] = blue(box2[1]);
        box2[2] = green(box2[2]);
        box2[3] = red(box2[3]);
        box2[4] = lowWhite(box2[4]);

        box2 = padBoxLeft(box2, 3);
        box2 = padBoxRight(box2, 3);
        box2 = padBoxTop(box2, 1);
        box2 = padBoxBottom(box2, 1);
        box2 = box2.map(s => blackBg(s));
        box2 = padBoxLeft(box2, 2);

        const box = stackHorizontally(box1, box2);
        this.out('');
        box.forEach(s => this.out(s));
        this.out('');
        break;
      case 'bail-out':
        text = 'Bail out!';
        event.name && (text += ' ' + event.name);
        this.out(warning(text));
        break;
      case 'assert':
        text = (event.fail ? '✗' : '✓') + ' ' + (this.renumberAsserts ? ++this.assertCounter : event.id);
        if (event.skip) {
          text += ' SKIP';
        } else if (event.todo) {
          text += ' TODO';
        }
        event.name && (text += ' ' + event.name);
        if (!event.skip) {
          text = (event.fail && !event.todo ? red : green)(text);
        }
        !this.hideTime && (text += lowWhite(' - ' + formatTime(event.diffTime)));
        event.fail && event.at && (text += lowWhite(' - ' + event.at));
        this.out(text);

        // text = (event.fail ? 'not ok' : 'ok') + ' ' + (this.renumberAsserts ? ++this.assertCounter : event.id);
        // if (event.skip) {
        //   text += ' # SKIP';
        // } else if (event.todo) {
        //   text += ' # TODO';
        // }
        // event.name && (text += ' ' + event.name);
        // text += ' # time=' + event.diffTime.toFixed(3) + 'ms';
        // this.write(text, event.fail ? 'failure' : 'success');
        // if (event.fail) {
        //   this.write('  ---', 'yaml');
        //   if (this.useJson) {
        //     this.write('  operator: ' + event.operator, 'yaml');
        //     if (event.data && typeof event.data == 'object') {
        //       if (event.data.hasOwnProperty('expected')) {
        //         try {
        //           this.write('  expected: ' + JSON.stringify(event.data.expected), 'yaml');
        //         } catch (error) {
        //           // squelch
        //         }
        //       }
        //       if (event.data.hasOwnProperty('actual')) {
        //         try {
        //           this.write('  actual:   ' + JSON.stringify(event.data.actual), 'yaml');
        //         } catch (error) {
        //           // squelch
        //         }
        //       }
        //     }
        //     event.at && this.write('  at: ' + event.at, 'yaml');
        //   } else {
        //     yamlFormatter({operator: event.operator}, formatterOptions).forEach(line => this.write(line, 'yaml'));
        //     if (event.data) {
        //       yamlFormatter(
        //         {
        //           expected: event.data.expected,
        //           actual: event.data.actual
        //         },
        //         formatterOptions
        //       ).forEach(line => this.write(line, 'yaml'));
        //     }
        //     yamlFormatter({at: event.at}, formatterOptions).forEach(line => this.write(line, 'yaml'));
        //   }
        //   const error = event.data && event.data.actual instanceof Error ? event.data.actual : event.marker,
        //     stack = error && error.stack;
        //   if (typeof stack == 'string') {
        //     this.write('  stack: |-', 'yaml');
        //     stack.split('\n').forEach(line => this.write('    ' + line, 'yaml'));
        //   }
        //   this.write('  ...', 'yaml');
        // }
        break;
    }
  }
}

export default TTYReporter;
