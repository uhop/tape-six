import {stringRep, normalizeBox, padBox, padBoxLeft, drawBox, stackHorizontally} from './box.js';
import {formatNumber, formatTime, formatValue} from './formatters.js';

// colors

const to6 = x => Math.min(5, Math.round((Math.max(0, Math.min(255, x)) / 255) * 6));
const buildColor = (r, g, b) => 16 + 36 * to6(r) + 6 * to6(g) + to6(b);

const red = text => join('\x1B[31m', text, '\x1B[39m'),
  green = text => join('\x1B[92m', text, '\x1B[39m'),
  blue = text => join('\x1B[94m', text, '\x1B[39m'),
  blackBg = text => join('\x1B[40m', text, '\x1B[49m'),
  lowWhite = text => join('\x1B[2;37m', text, '\x1B[22;39m'),
  brightWhite = text => join('\x1B[1;97m', text, '\x1B[22;39m'),
  brightYellow = text => join('\x1B[1;93m', text, '\x1B[22;39m'),
  warning = text => join('\x1B[41;1;37m', text, '\x1B[22;39;49m'),
  italic = text => join('\x1B[3m', text, '\x1B[23m'),
  successStyle = `\x1B[48;5;${buildColor(0, 32, 0)};1;97m`,
  failureStyle = `\x1B[48;5;${buildColor(64, 0, 0)};1;97m`,
  reset = '\x1B[0m';

// utilities

const join = (...args) => args.reduce((acc, val) => acc + (val || ''), '');

// main

class TTYReporter {
  constructor({output = process.stdout, renumberAsserts = false, failureOnly = false, showBanner = true, showTime = true, showData = true} = {}) {
    if (!output || !output.isTTY) throw Error('Module TTYReporter works only with TTY output streams.');

    this.output = output;
    this.renumberAsserts = renumberAsserts;
    this.failureOnly = failureOnly;
    this.showBanner = showBanner;
    this.showTime = showTime;
    this.showData = showData;
    this.depth = this.assertCounter = this.failedAsserts = this.successfulAsserts = 0;

    this.out('');
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
    this.output.moveCursor(0, -1);
    this.output.clearLine(0);
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
          text += this.makeState(event.data);
          this.showTime && (text += lowWhite(' - ' + formatTime(event.diffTime)));
          this.out(text);
          break;
        }
        // summary
        const state = event.data,
          success = state.asserts - state.failed - state.skipped;

        if (!this.showBanner) {
          this.out(
            blackBg(
              '  ' +
                (event.fail ? '⛔' : '♥️') +
                '  ' +
                brightWhite('total: ' + formatNumber(state.asserts)) +
                ', ' +
                blue('skipped: ' + formatNumber(state.skipped)) +
                ', ' +
                green('passed: ' + formatNumber(success)) +
                ', ' +
                red('failed: ' + formatNumber(state.failed)) +
                ', ' +
                lowWhite('time: ' + formatTime(event.diffTime)) +
                '  '
            )
          );
          return;
        }

        const paintStyle = event.fail ? failureStyle : successStyle;
        let box1 = ['Summary: ' + (event.fail ? 'fail' : 'pass')];
        box1 = padBox(box1, 0, 2);
        box1 = drawBox(box1);
        box1 = padBox(box1, 0, 3);
        box1 = normalizeBox([...box1, '', 'Passed: ' + (event.fail ? formatNumber((success / state.asserts) * 100, 1) + '%' : '100%')], ' ', 'center');
        box1 = padBox(box1, 1, 0);
        box1 = box1.map(s => join(paintStyle, s, reset));
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

        box2 = padBox(box2, 1, 3);
        box2 = box2.map(s => blackBg(s));

        const box = stackHorizontally(box1, box2);
        this.out('');
        box.forEach(s => this.out(s));
        this.out('');
        return;
      case 'bail-out':
        text = 'Bail out!';
        event.name && (text += ' ' + event.name);
        this.out(warning(text));
        return;
      case 'assert':
        const isFailed = event.fail && !event.todo;
        isFailed ? ++this.failedAsserts : ++this.successfulAsserts;
        text = (event.fail ? '✗' : '✓') + ' ' + (this.renumberAsserts ? ++this.assertCounter : event.id);
        if (!isFailed && this.failureOnly) break;
        if (event.skip) {
          text += ' SKIP';
        } else if (event.todo) {
          text += ' TODO';
        }
        event.name && (text += ' ' + event.name);
        if (!event.skip) {
          text = (isFailed ? red : green)(text);
        }
        this.showTime && (text += lowWhite(' - ' + formatTime(event.diffTime)));
        event.fail && event.at && (text += lowWhite(' - ' + event.at));
        this.out(text);

        if (!event.fail || !this.showData) break;

        this.out(lowWhite('  operator: ') + event.operator);
        if (event.data && typeof event.data == 'object') {
          if (event.data.hasOwnProperty('expected')) {
            this.out(lowWhite('  expected: ') + formatValue(event.data.expected));
          }
          if (event.data.hasOwnProperty('actual')) {
            this.out(lowWhite('  actual:   ') + formatValue(event.data.actual));
          }
        }
        const error = event.data && event.data.actual instanceof Error ? event.data.actual : event.marker,
          stack = error && error.stack;
        if (typeof stack == 'string') {
          this.out(lowWhite('  stack: |-'));
          stack.split('\n').forEach(line => this.out(lowWhite('    ' + line)));
        }
        break;
    }
    this.showScore();
  }
  showScore() {
    this.out(successStyle + '  ' + this.successfulAsserts + '  ' + failureStyle + '  ' + this.failedAsserts + '  ' + reset);
  }
  makeState(state) {
    const success = state.asserts - state.skipped - state.failed;
    if (!success && !state.failed && !state.skipped) return '';
    return (
      ' ' +
      (success ? successStyle + ' ' + formatNumber(success) + ' ' : blackBg(' ' + formatNumber(success) + ' ')) +
      (state.failed ? failureStyle + ' ' + formatNumber(state.failed) + ' ' : blackBg(' ' + formatNumber(state.failed) + ' ')) +
      (state.skipped ? blackBg(blue(' ' + formatNumber(state.failed) + ' ')) : '') +
      reset
    );
  }
}

export default TTYReporter;
