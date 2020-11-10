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

// colors
const red = text => join('\u001B[31m', text, '\u001B[0m'),
  green = text => join('\u001B[92m', text, '\u001B[0m'),
  blue = text => join('\u001B[94m', text, '\u001B[0m'),
  lowWhite = text => join('\u001B[2;37m', text, '\u001B[0m'),
  brightWhite = text => join('\u001B[1;97m', text, '\u001B[0m'),
  warning = text => join('\u001B[41;1;37m', text, '\u001B[0m'),
  italic = text => join('\u001B[3m', text, '\u001B[0m');

const to6 = x => Math.min(5, Math.round((Math.max(0, Math.min(255, x)) / 255) * 6));
const buildColor = (r, g, b) => 16 + 36 * to6(r) + 6 * to6(g) + to6(b);

const formatTime = ms => ms.toFixed(3) + 'ms';

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

        const paintColor = `\u001B[48;5;${event.fail ? buildColor(64, 0, 0) : buildColor(0, 32, 0)};1;97m`;
        this.out(join('\n  ', paintColor, stringRep(25), '\u001B[0m   ', brightWhite('tests:   ' + state.asserts)));
        this.out(join('  ', paintColor, '   \u256D', stringRep(17, '\u2500'), '\u256E   ', '\u001B[0m   ', 'skipped: ' + state.skipped));
        this.out(join('  ', paintColor, '   \u2502  Summary: ', event.fail ? 'fail' : 'pass', '  \u2502   ', '\u001B[0m   ', green('passed:  ' + success)));
        this.out(join('  ', paintColor, '   \u2570', stringRep(17, '\u2500'), '\u256F   ', '\u001B[0m   ', red('failed:  ' + state.failed)));
        this.out(join('  ', paintColor, stringRep(25), '\u001B[0m   ', lowWhite('time:    ' + formatTime(event.diffTime)), '\n'));

        // const state = event.data,
        //   success = state.asserts - state.failed - state.skipped;
        // this.write('1..' + state.asserts, 'summary');
        // this.write('# tests ' + state.asserts, 'summary');
        // state.skipped && this.write('# skip  ' + state.skipped, 'summary-info');
        // success && this.write('# pass  ' + success, 'summary-success');
        // state.failed && this.write('# fail  ' + state.failed, 'summary-failure');
        // this.write('# ' + (event.fail ? 'not ok' : 'ok'), event.fail ? 'summary-result-failure' : 'summary-result-success');
        // this.write('# time=' + event.diffTime.toFixed(3) + 'ms', 'summary-info');
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
