import process from 'node:process';

import {signature} from './State.js';
import {normalizeBox, padBox, padBoxLeft, drawBox, stackHorizontally} from './utils/box.js';
import {formatNumber, formatTime} from './utils/formatters.js';

// colors

const join = (...args) => args.filter(value => value).join('');
const to6 = x => Math.min(5, Math.round((Math.max(0, Math.min(255, x)) / 255) * 6));
const buildColor = (r, g, b) => 16 + 36 * to6(r) + 6 * to6(g) + to6(b);

const successStyle = `\x1B[48;5;${buildColor(0, 32, 0)};1;97m`,
  failureStyle = `\x1B[48;5;${buildColor(64, 0, 0)};1;97m`,
  skippedStyle = `\x1B[48;5;${buildColor(0, 0, 64)};1;97m`,
  reset = '\x1B[0m';

const consoleDict = {
  log: 'log',
  info: 'inf',
  warn: 'wrn',
  error: 'err'
};

// main

export class TTYReporter {
  constructor({
    output = process.stdout,
    renumberAsserts = false,
    failureOnly = false,
    showBanner = output.isTTY,
    showTime = true,
    showData = true,
    showAssertNumber = false,
    hasColors = true,
    dontCaptureConsole = false,
    hideStreams = false,
    originalConsole
  } = {}) {
    this.output = output;
    this.console = originalConsole || console;
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
    this.hideStreams = hideStreams;

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
    this.stdoutPaint = this.paint('\x1B[90m');
    this.stderrPaint = this.paint('\x1B[31m');

    // watching for console output

    this.consoleWasUsed = false;
    this.consoleSkipChecks = false;

    this.overrideLastLine = false;

    while (dontCaptureConsole && this.output.isTTY) {
      const isCurrentTTY = this.output === process.stdout || this.output === process.stderr;
      if (!isCurrentTTY) break;

      const self = this;
      globalThis.console = new Proxy(this.console, {
        get(target, property, receiver) {
          const prop = Reflect.get(target, property, receiver);
          if (typeof prop !== 'function') return prop;
          return (...args) => {
            if (!self.consoleSkipChecks) self.consoleWasUsed = true;
            return prop.apply(receiver, args);
          };
        }
      });

      break;
    }
  }
  paint(prefix, suffix = '\x1B[39m') {
    return this.hasColors ? text => join(prefix, text, suffix) : text => text;
  }
  formatValue(value) {
    if (typeof value == 'string') return value;
    if (value && value[signature] === signature) {
      value = {...value};
      delete value[signature];
      return this.blue(JSON.stringify(value));
    }
    return this.red(this.italic(JSON.stringify(value)));
  }
  out(text, noIndent) {
    if (noIndent) {
      this.output.write(text + '\n');
    } else {
      const indent = '  '.repeat(this.depth);
      this.output.write(indent + text + '\n');
    }
    ++this.lines;
    return this;
  }
  report(event) {
    this.consoleSkipChecks = true;
    try {
      this.reportInternal(event);
    } finally {
      this.consoleSkipChecks = false;
    }
  }
  reportInternal(event) {
    if (this.output.isTTY) {
      if (!this.consoleWasUsed && this.overrideLastLine) {
        this.output.moveCursor(0, -1);
        this.output.clearLine(0);
      }
      this.consoleWasUsed = this.overrideLastLine = false;
    }
    let text;
    switch (event.type) {
      case 'test':
        if (event.name || event.test > 0) {
          if (!this.failureOnly) {
            if (event.test) {
              this.out('\u25CB ' + (event.name || this.italic('anonymous test')));
            } else {
              this.out('\u25CB ' + this.blue(this.italic(event.name)));
            }
          }
          ++this.depth;
        }
        ++this.testCounter;
        this.testStack.push({name: event.name, test: event.test, lines: this.lines, fail: false});
        break;
      case 'end':
        const theTest = this.testStack.pop();
        if (theTest.name || theTest.test > 0) {
          --this.depth;
          if (!this.failureOnly || event.fail) {
            let name = '';
            if (event.test) {
              name = event.name || this.italic('anonymous test');
            } else {
              name = this.italic(event.name);
            }
            text = (event.fail ? '✗' : '✓') + ' ' + name;
            text = event.fail ? this.brightRed(text) : this.green(text);
            text += this.makeState(event.data);
            this.showTime && (text += this.lowWhite(' - ' + formatTime(event.diffTime)));
            this.out(text);
          }
        }
        if (this.testStack.length) break;

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
      case 'console-log':
      case 'console-info':
      case 'console-warn':
        if (!this.failureOnly && !this.hideStreams) {
          const lines = event.name.split(/\r?\n/),
            type = /\-(\w+)$/.exec(event.type)[1],
            prefix = this.stdoutPaint(consoleDict[type] + ':') + ' ';
          for (const line of lines) {
            this.out(prefix + line);
          }
        }
        break;
      case 'console-error':
        if (!this.hideStreams) {
          const lines = event.name.split(/\r?\n/),
            prefix = this.stderrPaint(consoleDict.error + ':') + ' ';
          for (const line of lines) {
            this.out(prefix + line);
          }
        }
        break;
      case 'stdout':
        if (!this.failureOnly && !this.hideStreams) {
          const lines = event.name.split(/\r?\n/),
            prefix = this.stdoutPaint('stdout:') + ' ';
          for (const line of lines) {
            this.out(prefix + line);
          }
        }
        break;
      case 'stderr':
        if (!this.hideStreams) {
          const lines = event.name.split(/\r?\n/),
            prefix = this.stderrPaint('stderr:') + ' ';
          for (const line of lines) {
            this.out(prefix + line);
          }
        }
        break;
      case 'bail-out':
        {
          text = 'Bail out!';
          event.name && (text += ' ' + event.name);
          let box = [text];
          box = padBox(box, 0, 1);
          box = drawBox(box);
          box = padBox(box, 0, 1);
          box.forEach(s => this.out(this.warning(s), true));
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

        const expected = event.expected && JSON.parse(event.expected);
        if (event.hasOwnProperty('expected')) {
          this.out(this.lowWhite('  expected: ') + this.formatValue(expected));
        }

        const actual = event.actual && JSON.parse(event.actual);
        if (event.hasOwnProperty('actual')) {
          this.out(this.lowWhite('  actual:   ') + this.formatValue(actual));
        }

        const stack =
          actual?.type === 'Error' && typeof actual.stack == 'string'
            ? actual.stack
            : event.marker.stack;
        if (typeof stack == 'string') {
          this.out(this.lowWhite('  stack: |-'));
          stack.split('\n').forEach(line => this.out(this.lowWhite('    ' + line)));
        }
        break;
    }
    if (this.output.isTTY) {
      this.showScore();
      this.overrideLastLine = true;
    }
  }
  showScore() {
    this.out(
      this.success('  ' + this.successfulAsserts + '  ') +
        this.failure('  ' + this.failedAsserts + '  ') +
        (this.skippedAsserts ? this.skipped('  ' + this.skippedAsserts + '  ') : ''),
      true
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
