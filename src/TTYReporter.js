import process from 'node:process';
import {
  stringRep,
  normalizeBox,
  padBox,
  padBoxLeft,
  drawBox,
  stackHorizontally
} from './utils/box.js';
import {formatNumber, formatTime} from './utils/formatters.js';

// colors

const join = (...args) => args.filter(value => value).join('');
const to6 = x => Math.min(5, Math.round((Math.max(0, Math.min(255, x)) / 255) * 6));
const buildColor = (r, g, b) => 16 + 36 * to6(r) + 6 * to6(g) + to6(b);

const successStyle = `\x1B[48;5;${buildColor(0, 32, 0)};1;97m`,
  failureStyle = `\x1B[48;5;${buildColor(64, 0, 0)};1;97m`,
  skippedStyle = `\x1B[48;5;${buildColor(0, 0, 64)};1;97m`,
  reset = '\x1B[0m';

// main

class TTYReporter {
  constructor({
    output = process.stdout,
    renumberAsserts = false,
    failureOnly = false,
    showBanner = output.isTTY,
    showTime = true,
    showData = true,
    showAssertNumber = false,
    hasColors = true
  } = {}) {
    this.output = output;
    this.hasColors =
      hasColors &&
      this.output.isTTY &&
      (typeof this.output.hasColors == 'function' ? this.output.hasColors(256) : true);
    this.renumberAsserts = renumberAsserts;
    this.failureOnly = failureOnly;
    this.showBanner = showBanner;
    this.showTime = showTime;
    this.showData = showData;
    this.showAssertNumber = showAssertNumber;

    this.depth =
      this.assertCounter =
      this.failedAsserts =
      this.successfulAsserts =
      this.skippedAsserts =
      this.todoAsserts =
        0;
    this.testCounter = -1;
    this.technicalDepth = 0;

    this.lines = 0;
    this.testStack = [];

    // colors
    this.red = this.paint('\x1B[31m');
    this.green = this.paint('\x1B[92m');
    this.blue = this.paint('\x1B[94m');
    this.yellow = this.paint('\x1B[93m');
    this.blackBg = this.paint('\x1B[40m', '\x1B[49m');
    this.lowWhite = this.paint('\x1B[2;37m', '\x1B[22;39m');
    this.brightWhite = this.paint('\x1B[1;97m', '\x1B[22;39m');
    this.brightYellow = this.paint('\x1B[1;93m', '\x1B[22;39m');
    this.brightRed = this.paint('\x1B[91m');
    this.italic = this.paint('\x1B[3m', '\x1B[23m');
    this.warning = this.paint('\x1B[41;1;37m', '\x1B[22;39;49m');
    this.success = this.paint(successStyle, reset);
    this.failure = this.paint(failureStyle, reset);
    this.skipped = this.paint(skippedStyle, reset);

    this.output.isTTY && this.out('');
  }
  paint(prefix, suffix = '\x1B[39m') {
    return this.hasColors ? text => join(prefix, text, suffix) : text => text;
  }
  formatValue(value) {
    if (typeof value == 'string') return value;
    if (typeof value.type == 'string') return this.blue(JSON.stringify(value));
    return this.red(this.italic(JSON.stringify(value)));
  }
  out(text) {
    if (this.depth < 2 + this.technicalDepth) {
      this.output.write(text + '\n');
    } else {
      this.output.write(stringRep(this.depth - 1 - this.technicalDepth, '  ') + text + '\n');
    }
    ++this.lines;
    return this;
  }
  report(event) {
    if (this.output.isTTY) {
      this.output.moveCursor(0, -1);
      this.output.clearLine(0);
    }
    let text;
    switch (event.type) {
      case 'test':
        this.depth > this.technicalDepth &&
          !this.failureOnly &&
          this.out('\u25CB ' + (event.name || 'anonymous test'));
        ++this.depth;
        ++this.testCounter;
        this.testStack.push({name: event.name, lines: this.lines, fail: false});
        break;
      case 'end':
        this.testStack.pop();
        --this.depth;
        if (this.depth > this.technicalDepth) {
          if (this.failureOnly) break;
          text = (event.fail ? '✗' : '✓') + ' ' + (event.name || this.italic('anonymous test'));
          text = event.fail ? this.brightRed(text) : this.green(text);
          text += this.makeState(event.data);
          this.showTime && (text += this.lowWhite(' - ' + formatTime(event.diffTime)));
          this.out(text);
          break;
        }
        if (this.depth) break;

        // summary
        {
          const state = event.data,
            total = state.asserts - state.skipped,
            success = total - state.failed;

          if (!this.showBanner || !this.output.isTTY) {
            this.out(
              this.blackBg(
                '  ' +
                  (event.fail ? '⛔' : '♥️') +
                  '   ' +
                  this.brightWhite('tests: ' + formatNumber(this.testCounter)) +
                  ', ' +
                  ('asserts: ' + formatNumber(state.asserts)) +
                  ', ' +
                  this.green('passed: ' + formatNumber(success)) +
                  ', ' +
                  this.red('failed: ' + formatNumber(state.failed)) +
                  ', ' +
                  this.blue('skipped: ' + formatNumber(state.skipped)) +
                  ', ' +
                  this.brightYellow('todo: ' + formatNumber(this.todoAsserts)) +
                  ', ' +
                  this.lowWhite('time: ' + formatTime(event.diffTime)) +
                  '  '
              )
            );
            return;
          }

          const paintMethod = event.fail ? 'failure' : 'success';
          let box1 = [event.fail ? 'Need work' : 'All good!'];
          box1 = padBox(box1, 0, 2);
          box1 = drawBox(box1);
          box1 = padBox(box1, 0, 3);
          box1 = normalizeBox(
            [
              ...box1,
              '',
              'Passed: ' +
                (event.fail
                  ? formatNumber((total > 0 ? success / total : 1) * 100, 1) + '%'
                  : '100%')
            ],
            ' ',
            'center'
          );
          box1 = padBox(box1, 2, 0);
          box1 = box1.map(s => this[paintMethod](s));
          box1 = padBoxLeft(box1, 2);

          let box2 = normalizeBox(
            [
              formatNumber(this.testCounter),
              formatNumber(state.asserts),
              formatNumber(success),
              formatNumber(state.failed),
              formatNumber(state.skipped),
              formatNumber(this.todoAsserts),
              formatTime(event.diffTime)
            ],
            ' ',
            'left'
          );
          box2 = padBoxLeft(box2, 1);
          box2 = stackHorizontally(
            normalizeBox([
              'tests:',
              'asserts:',
              '  passed:',
              '  failed:',
              '  skipped:',
              '  todo:',
              'time:'
            ]),
            box2
          );

          box2[0] = this.brightWhite(box2[0]);
          // box2[1] = this.brightYellow(box2[1]);
          box2[2] = this.green(box2[2]);
          box2[3] = this.red(box2[3]);
          box2[4] = this.blue(box2[4]);
          box2[5] = this.brightYellow(box2[5]);
          box2[6] = this.lowWhite(box2[6]);

          box2 = padBox(box2, 1, 3);
          box2 = box2.map(s => this.blackBg(s));

          const box = stackHorizontally(box1, box2);
          this.out('');
          box.forEach(s => this.out(s));
          this.out('');
        }
        return;
      case 'comment':
        !this.failureOnly && this.out(this.blue(this.italic(event.name || 'empty comment')));
        break;
      case 'bail-out':
        {
          text = 'Bail out!';
          event.name && (text += ' ' + event.name);
          let box = [text];
          box = padBox(box, 0, 1);
          box = drawBox(box);
          box = padBox(box, 0, 1);

          const currentDepth = this.depth;
          this.depth = 0;
          box.forEach(s => this.out(this.warning(s)));
          this.depth = currentDepth;
        }
        break;
      case 'assert':
        const lastTest = this.testStack[this.testStack.length - 1],
          isFailed = event.fail && !event.skip && !event.todo;
        isFailed ? ++this.failedAsserts : ++this.successfulAsserts;
        event.skip && ++this.skippedAsserts;
        event.todo && ++this.todoAsserts;
        if (!isFailed && this.failureOnly) break;
        text = event.fail ? '✗' : '✓';
        if (this.showAssertNumber) {
          text += ' ' + (this.renumberAsserts ? ++this.assertCounter : event.id);
        }
        if (event.skip) {
          text += ' SKIP';
        } else if (event.todo) {
          text += ' ' + this.brightYellow('TODO');
        }
        event.name && (text += ' ' + event.name);
        if (event.skip) {
          text = this.blue(text);
        } else {
          text = isFailed ? this.red(text) : this.green(text);
        }
        this.showTime && (text += this.lowWhite(' - ' + formatTime(event.diffTime)));
        event.fail && event.at && (text += this.lowWhite(' - ' + event.at));
        if (this.failureOnly && !lastTest.fail) {
          lastTest.fail = true;
          --this.depth;
          this.out(this.brightRed('✗ ' + (lastTest.name || 'anonymous test')));
          ++this.depth;
        }
        this.out(text);

        if (!event.fail || event.skip || !this.showData) break;

        this.out(this.lowWhite('  operator: ') + event.operator);
        if (event.hasOwnProperty('expected')) {
          this.out(this.lowWhite('  expected: ') + this.formatValue(event.expected));
        }
        if (event.hasOwnProperty('actual')) {
          this.out(this.lowWhite('  actual:   ') + this.formatValue(event.actual));
        }
        const stack =
          event.actual && event.actual.type === 'Error' && typeof event.actual.stack == 'string'
            ? event.actual.stack
            : event.marker.stack;
        if (typeof stack == 'string') {
          this.out(this.lowWhite('  stack: |-'));
          stack.split('\n').forEach(line => this.out(this.lowWhite('    ' + line)));
        }
        break;
    }
    this.output.isTTY && this.showScore();
  }
  showScore() {
    this.out(
      this.success('  ' + this.successfulAsserts + '  ') +
        this.failure('  ' + this.failedAsserts + '  ') +
        (this.skippedAsserts ? this.skipped('  ' + this.skippedAsserts + '  ') : '')
    );
  }
  makeState(state) {
    const success = state.asserts - state.skipped - state.failed;
    if (!success && !state.failed && !state.skipped) return '';
    return (
      ' ' +
      this[success ? 'success' : 'blackBg'](' ' + formatNumber(success) + ' ') +
      this[state.failed ? 'failure' : 'blackBg'](' ' + formatNumber(state.failed) + ' ') +
      (state.skipped ? this.blackBg(this.blue(' ' + formatNumber(state.skipped) + ' ')) : '')
    );
  }
}

export default TTYReporter;
