import yamlFormatter from './utils/yamlFormatter.js';

const formatterOptions = {offset: 2};

const styles = {
  info: 'color: blue; font-style: italic;',
  success: 'color: green;',
  failure: 'color: red;',
  summary: 'font-weight: bold;',
  'summary-info': 'font-weight: bold; color: blue; font-style: italic;',
  'summary-success': 'font-weight: bold; color: green;',
  'summary-failure': 'font-weight: bold; color: red;',
  'summary-result-success': 'font-weight: bold; color: white; background-color: green; padding: 0.5em 1em;',
  'summary-result-failure': 'font-weight: bold; color: white; background-color: red; padding: 0.5em 1em;',
  'bail-out': 'color: white; background-color: red; font-weight: bold; padding: 0.5em 1em;'
};

const logger = (text, style) => {
  const css = typeof style == 'string' && styles[style];
  if (css) {
    console.log('%c' + text, css);
  } else {
    console.log(text);
  }
};

const formatValue = value => {
  if (typeof value == 'string') return value;
  return JSON.stringify(value);
};

class TapReporter {
  constructor({write = logger, useJson = false, renumberAsserts = false} = {}) {
    this.write = write;
    this.renumberAsserts = renumberAsserts;
    this.useJson = useJson;
    this.depth = 0;
    this.assertCounter = 0;
    this.opened = false;
  }
  open() {
    if (!this.opened) {
      this.write('TAP version 13');
      this.opened = true;
    }
  }
  report(event) {
    let text;
    switch (event.type) {
      case 'test':
        this.open();
        event.name && this.write('# start: ' + event.name, 'info');
        ++this.depth;
        break;
      case 'comment':
        this.open();
        this.write('# ' + event.name);
        break;
      case 'end':
        --this.depth;
        event.name && this.write('# finish: ' + event.name + ' # time=' + event.diffTime.toFixed(3) + 'ms', 'info');
        if (this.depth) break;
        const state = event.data,
          success = state.asserts - state.failed - state.skipped;
        this.write('1..' + state.asserts, 'summary');
        this.write('# tests ' + state.asserts, 'summary');
        state.skipped && this.write('# skip  ' + state.skipped, 'summary-info');
        success && this.write('# pass  ' + success, 'summary-success');
        state.failed && this.write('# fail  ' + state.failed, 'summary-failure');
        this.write('# ' + (event.fail ? 'not ok' : 'ok'), event.fail ? 'summary-result-failure' : 'summary-result-success');
        this.write('# time=' + event.diffTime.toFixed(3) + 'ms', 'summary-info');
        break;
      case 'bail-out':
        this.open();
        text = 'Bail out!';
        event.name && (text += ' ' + event.name);
        this.write(text, 'bail-out');
        break;
      case 'assert':
        this.open();
        text = (event.fail ? 'not ok' : 'ok') + ' ' + (this.renumberAsserts ? ++this.assertCounter : event.id);
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
            yamlFormatter({operator: event.operator}, formatterOptions).forEach(line => this.write(line, 'yaml'));
            if (event.data) {
              yamlFormatter(
                {
                  expected: event.data.expected,
                  actual: event.data.actual
                },
                formatterOptions
              ).forEach(line => this.write(line, 'yaml'));
            }
            yamlFormatter({at: event.at}, formatterOptions).forEach(line => this.write(line, 'yaml'));
          }
          const stack = event.actual && event.actual.type === 'Error' && typeof event.actual.stack == 'string' ? event.actual.stack : event.marker.stack;
          if (typeof stack == 'string') {
            this.write('  stack: |-', 'yaml');
            stack.split('\n').forEach(line => this.write('    ' + line, 'yaml'));
          }
          this.write('  ...', 'yaml');
        }
        break;
    }
  }
}

export default TapReporter;
