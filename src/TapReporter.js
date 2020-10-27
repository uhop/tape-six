import yamlFormatter from './yamlFormatter.js';

const formatterOptions = {offset: 2};

class TapReporter {
  constructor({write = console.log, useJson = false, renumberAsserts = false} = {}) {
    this.write = write;
    this.useJson = useJson;
    this.depth = 0;
    this.assertCounter = 0;
    this.renumberAsserts = renumberAsserts;
  }
  report(event) {
    let text;
    switch (event.type) {
      case 'test':
        !this.depth && this.write('TAP version 13');
        event.name && this.write('# start: ' + event.name);
        ++this.depth;
        break;
      case 'comment':
        this.write('# ' + event.name);
        break;
      case 'end':
        --this.depth;
        event.name && this.write('# finish: ' + event.name + ' # time=' + event.diffTime.toFixed(3) + 'ms');
        if (this.depth) break;
        const state = event.data,
          success = state.asserts - state.failed - state.skipped;
        this.write('1..' + state.asserts);
        this.write('# tests ' + state.asserts);
        state.skipped && this.write('# skip  ' + state.skipped);
        success && this.write('# pass  ' + success);
        state.failed && this.write('# fail  ' + state.failed);
        this.write('# ' + (event.fail ? 'not ok' : 'ok'));
        this.write('# time=' + event.diffTime.toFixed(3) + 'ms');
        break;
      case 'bail-out':
        text = 'Bail out!';
        event.name && (text += ' ' + event.name);
        this.write(text);
        break;
      case 'assert':
        text = (event.fail ? 'not ok' : 'ok') + ' ' + (this.renumberAsserts ? ++this.assertCounter : event.id);
        if (event.skip) {
          text += ' # SKIP';
        } else if (event.todo) {
          text += ' # TODO';
        }
        event.name && (text += ' ' + event.name);
        text += ' # time=' + event.diffTime.toFixed(3) + 'ms';
        this.write(text);
        if (event.fail) {
          this.write('  ---');
          if (this.useJson) {
            this.write('  operator: ' + event.operator);
            if (event.data && typeof event.data == 'object') {
              if (event.data.hasOwnProperty('expected')) {
                try {
                  this.write('  expected: ' + JSON.stringify(event.data.expected));
                } catch (error) {
                  // squelch
                }
              }
              if (event.data.hasOwnProperty('actual')) {
                try {
                  this.write('  actual:   ' + JSON.stringify(event.data.actual));
                } catch (error) {
                  // squelch
                }
              }
            }
            event.at && this.write('  at: ' + event.at);
          } else {
            yamlFormatter({operator: event.operator}, formatterOptions).forEach(line => this.write(line));
            if (event.data) {
              yamlFormatter(
                {
                  expected: event.data.expected,
                  actual: event.data.actual
                },
                formatterOptions
              ).forEach(line => this.write(line));
            }
            yamlFormatter({at: event.at}, formatterOptions).forEach(line => this.write(line));
          }
          const error = event.data && event.data.actual instanceof Error ? event.data.actual : event.marker,
            stack = error && error.stack;
          if (typeof stack == 'string') {
            this.write('  stack: |-');
            stack.split('\n').forEach(line => this.write('    ' + line));
          }
          this.write('  ...');
        }
        break;
    }
  }
}

export default TapReporter;
