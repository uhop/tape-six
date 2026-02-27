import process from 'node:process';

import Reporter from './Reporter.js';
import {signature} from '../State.js';
import {normalizeBox, padBox, padBoxLeft, drawBox, stackHorizontally} from '../utils/box.js';
import {formatNumber, formatTime} from '../utils/formatters.js';

// colors

const join = (...args) => args.filter(value => value).join('');
const to6 = x => Math.min(5, Math.round((Math.max(0, Math.min(255, x)) / 255) * 6));
const buildColor = (r, g, b) => 16 + 36 * to6(r) + 6 * to6(g) + to6(b);

const successStyle = `\x1B[48;5;${buildColor(0, 32, 0)};1;97m`,
  failureStyle = `\x1B[48;5;${buildColor(64, 0, 0)};1;97m`,
  skippedStyle = `\x1B[48;5;${buildColor(0, 0, 64)};1;97m`,
  reset = '\x1B[0m';

// misc

const consoleDict = {
  log: 'log',
  info: 'inf',
  warn: 'wrn',
  error: 'err',
  assert: 'srt'
};

const getType = value => {
  const type = typeof value;
  let className = '';
  if (type === 'object') {
    className = value?.constructor?.name;
  }
  return className ? type + '/' + className : type;
};

// main

export class TTYReporter extends Reporter {
  constructor({
    output = process.stdout,
    renumberAsserts = false,
    failOnce = false,
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
    super({failOnce});
    this.output = output;
    this.console = originalConsole || console;
    this.hasColors =
      hasColors &&
      this.output.isTTY &&
      (typeof this.output.hasColors == 'function' ? this.output.hasColors(16) : true);
    this.renumberAsserts = renumberAsserts;
    this.failureOnly = failureOnly;
    this.showBanner = showBanner;
    this.showTime = showTime;
    this.showData = showData;
    this.showAssertNumber = showAssertNumber;
    this.hideStreams = hideStreams;

    this.visibleDepth =
      this.assertCounter =
      this.failedAsserts =
      this.successfulAsserts =
      this.skippedAsserts =
      this.todoAsserts =
        0;
    this.testCounter = 0;
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
    if (typeof value == 'string') return value + this.lowWhite(' - (' + getType(value) + ')');
    if (value && value[signature] === signature) {
      value = {...value};
      delete value[signature];
      return this.blue(JSON.stringify(value)) + this.lowWhite(' - (' + getType(value) + ')');
    }
    return this.red(
      this.italic(JSON.stringify(value)) + this.lowWhite(' - (' + getType(value) + ')')
    );
  }
  out(text, noIndent) {
    if (noIndent) {
      this.output.write(text + '\n');
    } else {
      const indent = '  '.repeat(Math.max(0, this.visibleDepth));
      this.output.write(indent + text + '\n');
    }
    ++this.lines;
    return this;
  }
  report(event, suppressStopTest = false) {
    this.consoleSkipChecks = true;
    try {
      this.reportInternal(event, suppressStopTest);
    } finally {
      this.consoleSkipChecks = false;
    }
  }
  reportInternal(event, suppressStopTest = false) {
    if (this.output.isTTY) {
      if (!this.consoleWasUsed && this.overrideLastLine) {
        this.output.moveCursor(0, -1);
        this.output.clearLine(0);
      }
      this.consoleWasUsed = this.overrideLastLine = false;
    }
    event = this.state?.preprocess(event) || event;
    let text;
    switch (event.type) {
      case 'test':
        event = this.onTest(event);
        if (event.name || event.test > 0) {
          if (!this.failureOnly) {
            if (event.test) {
              this.out('\u25CB ' + (event.name || this.italic('anonymous test')));
            } else {
              this.out('\u25CB ' + this.blue(this.italic(event.name)));
            }
          }
          ++this.visibleDepth;
          ++this.testCounter;
        }
        break;
      case 'end':
        const theTest = this.onEnd(event);
        if (theTest && (theTest.name || theTest.test > 0)) {
          --this.visibleDepth;
          if (!this.failureOnly || theTest.failed) {
            let name = '';
            if (theTest.test) {
              name = theTest.name || this.italic('anonymous test');
            } else {
              name = this.italic(theTest.name);
            }
            text = (theTest.failed ? '✗' : '✓') + ' ' + name;
            text = theTest.failed ? this.brightRed(text) : this.green(text);
            text += this.makeState(theTest);
            this.showTime && (text += this.lowWhite(' - ' + formatTime(event.diffTime)));
            this.out(text);
          }
        }
        if (this.state) break;
        return this.showSummary(theTest, event.diffTime);
      case 'terminated':
        this.onTerminated(event, 'reportInternal');
        break;
      case 'comment':
        if (!this.failureOnly) {
          const message = event.name || 'empty comment';
          for (const line of message.split(/\r?\n/)) {
            this.out(this.blue(this.italic(line)));
          }
        }
        break;
      case 'console':
        {
          const method = event.data?.method,
            isShown = method === 'error' || method === 'assert' || !this.failureOnly;
          if (isShown && !this.hideStreams) {
            const lines = event.name.split(/\r?\n/),
              paint = method === 'error' || method === 'assert' ? 'stderrPaint' : 'stdoutPaint',
              prefix = this[paint](consoleDict[method] + ':') + ' ';
            for (const line of lines) {
              this.out(prefix + line, this.failureOnly);
            }
          }
        }
        break;
      case 'stdout':
        if (!this.failureOnly && !this.hideStreams) {
          const lines = event.name.split(/\r?\n/),
            prefix = this.stdoutPaint('stdout:') + ' ';
          for (const line of lines) {
            this.out(prefix + line, this.failureOnly);
          }
        }
        break;
      case 'stderr':
        if (!this.hideStreams) {
          const lines = event.name.split(/\r?\n/),
            prefix = this.stderrPaint('stderr:') + ' ';
          for (const line of lines) {
            this.out(prefix + line, this.failureOnly);
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
      case 'assertion-error':
        {
          const isFailed = event.fail && !event.skip && !event.todo,
            nameLines = event.name ? event.name.split(/\r?\n/g) : [];
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
          nameLines[0] && (text += ' ' + nameLines[0]);
          if (event.skip) {
            text = this.blue(text);
          } else {
            text = isFailed ? this.red(text) : this.green(text);
          }
          this.showTime && (text += this.lowWhite(' - ' + formatTime(event.diffTime)));
          event.fail && event.at && (text += this.lowWhite(' - ' + event.at));
          if (this.failureOnly) {
            --this.visibleDepth;
            this.out(this.brightRed('✗ ' + (this.state?.name || 'anonymous test')));
            ++this.visibleDepth;
          }
          this.out(text);

          if (!event.fail || event.skip || !this.showData) break;

          this.out(this.lowWhite('  operator: ') + event.operator);

          if (nameLines.length > 1) {
            this.out(
              this.lowWhite(
                '  message:  |-' + (event.generatedMessage ? ' ' + this.italic('(generated)') : '')
              )
            );
            nameLines.forEach(line => this.out('    ' + line));
          }

          const expected = event.expected && JSON.parse(event.expected);
          if (event.hasOwnProperty('expected')) {
            this.out(this.lowWhite('  expected: ') + this.formatValue(expected));
          }

          const actual = event.actual && JSON.parse(event.actual);
          if (event.hasOwnProperty('actual')) {
            this.out(this.lowWhite('  actual:   ') + this.formatValue(actual));
          }

          this.out(this.lowWhite('  stack: |-'));
          event.stackList.forEach(line => this.out(this.lowWhite('    at ' + line)));
        }
        break;
    }
    if (this.output.isTTY) {
      this.showScore();
      this.overrideLastLine = true;
    }
    this.state?.postprocess(event, suppressStopTest);
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
  showSummary(state, diffTime) {
    const total = state.asserts - state.skipped,
      success = total - state.failed;

    if (!this.showBanner || !this.output.isTTY) {
      this.out(
        this.blackBg(
          '  ' +
            (state.failed ? '⛔' : '♥️') +
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
            this.lowWhite('time: ' + formatTime(diffTime)) +
            '  '
        )
      );
      return;
    }

    const paintMethod = state.failed ? 'failure' : 'success';
    let box1 = [state.failed ? 'Need work' : 'All good!'];
    box1 = padBox(box1, 0, 2);
    box1 = drawBox(box1);
    box1 = padBox(box1, 0, 3);
    box1 = normalizeBox(
      [
        ...box1,
        '',
        'Passed: ' +
          (state.failed ? formatNumber((total > 0 ? success / total : 1) * 100, 1) + '%' : '100%')
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
        formatTime(diffTime)
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
}

export default TTYReporter;
