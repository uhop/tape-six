import Reporter from './Reporter.js';
import {signature} from '../State.js';
import yamlFormatter from '../utils/yamlFormatter.js';

const formatterOptions = {offset: 2};

const styles = {
  info: 'color: #44f; font-style: italic;',
  success: 'color: green;',
  failure: 'color: red;',
  summary: 'font-weight: bold;',
  'summary-info': 'font-weight: bold; color: #44f; font-style: italic;',
  'summary-success': 'font-weight: bold; color: green;',
  'summary-failure': 'font-weight: bold; color: red;',
  'summary-result-success':
    'font-weight: bold; color: white; background-color: green; padding: 0.5em 1em;',
  'summary-result-failure':
    'font-weight: bold; color: white; background-color: red; padding: 0.5em 1em;',
  'bail-out': 'color: white; background-color: red; font-weight: bold; padding: 0.5em 1em;',
  stdout: 'color: gray; font-style: italic;',
  stderr: 'color: darkred; font-style: italic;'
};

const formatValue = value => {
  if (typeof value == 'string') return value;
  if (value && value[signature] === signature) {
    value = {...value};
    delete value[signature];
  }
  return JSON.stringify(value);
};

export class TapReporter extends Reporter {
  constructor({
    write,
    failOnce = false,
    useJson = false,
    renumberAsserts = false,
    hasColors = true,
    originalConsole
  } = {}) {
    super({failOnce});
    this.console = originalConsole || console;
    this.write = write || (hasColors ? this.logger : this.console.log.bind(this.console));
    this.renumberAsserts = renumberAsserts;
    this.useJson = useJson;
    this.assertCounter = 0;
    this.opened = false;
  }
  logger(text, style) {
    const css = typeof style == 'string' && styles[style];
    if (css) {
      this.console.log('%c' + text, css);
    } else {
      this.console.log(text);
    }
  }
  open() {
    if (!this.opened) {
      this.write('TAP version 13');
      this.opened = true;
    }
  }
  report(event) {
    event = this.state?.preprocess(event) || event;
    let text;
    switch (event.type) {
      case 'test':
        event = this.onTest(event);
        this.open();
        event.name && this.write('# start: ' + event.name, 'info');
        break;
      case 'end':
        const theState = this.onEnd(event);
        event.name &&
          this.write(
            '# finish: ' + theState.name + ' # time=' + event.diffTime.toFixed(3) + 'ms',
            'info'
          );
        if (this.depth) break;
        this.showSummary(theState, event.diffTime);
        break;
      case 'terminated':
        this.onTerminated(event);
        break;
      case 'comment':
        this.open();
        this.write('# ' + event.name);
        break;
      case 'console':
        this.open();
        switch (event.data?.method) {
          case 'log':
            this.write('# log: ' + event.name, 'stdout');
            break;
          case 'info':
            this.write('# info: ' + event.name, 'stdout');
            break;
          case 'warn':
            this.write('# warn: ' + event.name, 'stdout');
            break;
          case 'error':
            this.write('# error: ' + event.name, 'stderr');
            break;
          case 'assert':
            this.write('# assert: ' + event.name, 'stdout');
            break;
        }
        break;
      case 'stdout':
        this.open();
        this.write('# stdout: ' + event.name, 'stdout');
        break;
      case 'stderr':
        this.open();
        this.write('# stderr: ' + event.name, 'stderr');
        break;
      case 'bail-out':
        this.open();
        text = 'Bail out!';
        event.name && (text += ' ' + event.name);
        this.write(text, 'bail-out');
        break;
      case 'assert':
        this.open();
        text =
          (event.fail ? 'not ok' : 'ok') +
          ' ' +
          (this.renumberAsserts ? ++this.assertCounter : event.id);
        if (event.skip) {
          text += ' # SKIP';
        } else if (event.todo) {
          text += ' # TODO';
        }
        event.name && (text += ' ' + event.name);
        text += ' # time=' + event.diffTime.toFixed(3) + 'ms';
        this.write(text, event.fail ? 'failure' : 'success');
        if (event.fail) {
          this.write('  ---', 'yaml');
          if (this.useJson) {
            this.write('  operator: ' + event.operator, 'yaml');
            if (event.hasOwnProperty('expected')) {
              this.write('  expected: ' + formatValue(event.expected), 'yaml');
            }
            if (event.hasOwnProperty('actual')) {
              this.write('  actual:   ' + formatValue(event.actual), 'yaml');
            }
            event.at && this.write('  at: ' + event.at, 'yaml');
          } else {
            yamlFormatter({operator: event.operator}, formatterOptions).forEach(line =>
              this.write(line, 'yaml')
            );
            yamlFormatter(
              {
                expected: event.expected && JSON.parse(event.expected),
                actual: event.actual && JSON.parse(event.actual)
              },
              formatterOptions
            ).forEach(line => this.write(line, 'yaml'));
            yamlFormatter({at: event.at}, formatterOptions).forEach(line =>
              this.write(line, 'yaml')
            );
          }
          const actual = event.actual && JSON.parse(event.actual),
            stack =
              actual?.type === 'Error' && typeof actual.stack == 'string'
                ? actual.stack
                : event.marker.stack;
          if (typeof stack == 'string') {
            this.write('  stack: |-', 'yaml');
            stack.split('\n').forEach(line => this.write('    ' + line, 'yaml'));
          }
          this.write('  ...', 'yaml');
        }
        break;
    }
  }
  showSummary(state, diffTime) {
    const success = state.asserts - state.failed - state.skipped;
    this.write('1..' + state.asserts, 'summary');
    this.write('# tests ' + state.asserts, 'summary');
    state.skipped && this.write('# skip  ' + state.skipped, 'summary-info');
    success && this.write('# pass  ' + success, 'summary-success');
    state.failed && this.write('# fail  ' + state.failed, 'summary-failure');
    this.write(
      '# ' + (state.failed ? 'not ok' : 'ok'),
      state.failed ? 'summary-result-failure' : 'summary-result-success'
    );
    this.write('# time=' + diffTime.toFixed(3) + 'ms', 'summary-info');
  }
}

export default TapReporter;
