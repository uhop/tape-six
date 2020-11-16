class DomReporter {
  constructor({root, renumberAsserts = false} = {}) {
    this.root = root;
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;
    this.stack = []; // previous test nodes
    this.current = null; // the current test node
  }
  report(event) {
    let text;
    switch (event.type) {
      case 'test':
        this.stack.push(this.current);
        if (this.stack.length <= 1) break;
        this.current = document.createElement('div');
        this.current.className = 'test running';
        {
          const header = document.createElement('div');
          header.className = 'header';
          header.appendChild(document.createTextNode(event.name));
          this.current.appendChild(header);
        }
        this.root.appendChild(this.current);
        break;
      case 'end':
        if (this.current) {
          this.current.classList.remove('running');
          this.current.classList.add(event.fail ? 'failed' : 'passed');
          this.current = this.stack.pop();
          break;
        }
        // summary

        // event.name && this.write('# finish: ' + event.name + ' # time=' + event.diffTime.toFixed(3) + 'ms', 'info');
        // if (this.depth) break;
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
      case 'comment':
        {
          const comment = document.createElement('div');
          comment.className = 'comment text-comment';
          comment.appendChild(document.createTextNode(event.name));
          (this.current || this.root).appendChild(comment);
        }
        break;
      case 'bail-out':
        text = 'Bail out!';
        event.name && (text += ' ' + event.name);
        this.write(text, 'bail-out');
        {
          const bailOut = document.createElement('div');
          bailOut.className = 'bail-out';
          bailOut.appendChild(document.createTextNode(event.name));
          this.root.appendChild(bailOut);
        }
        break;
      case 'assert':
        {
          const assert = document.createElement('div');
          assert.className = 'assert ' + (event.fail ? 'failed' : 'passed');
          const header = document.createElement('div');
          header.className = 'header';
          header.appendChild(document.createTextNode(event.name));
          assert.appendChild(header);
          if (event.operator) {
            const row = document.createElement('div'),
              name = document.createElement('span'),
              value = document.createElement('code');
            row.className = 'data';
            name.className = 'name';
            name.appendChild(document.createTextNode('operator:'));
            value.className = 'value';
            value.appendChild(document.createTextNode(event.operator));
            row.appendChild(name);
            row.appendChild(value);
            assert.appendChild(row);
          }
          if (event.data) {
            if (event.data.hasOwnProperty('expected')) {
              const row = document.createElement('div'),
                name = document.createElement('span'),
                value = document.createElement('code');
              row.className = 'data';
              name.className = 'name';
              name.appendChild(document.createTextNode('expected:'));
              value.className = 'value';
              value.appendChild(document.createTextNode(JSON.stringify(event.data.expected)));
              row.appendChild(name);
              row.appendChild(value);
              assert.appendChild(row);
            }
            if (event.data.hasOwnProperty('actual')) {
              const row = document.createElement('div'),
                name = document.createElement('span'),
                value = document.createElement('code');
              row.className = 'data';
              name.className = 'name';
              name.appendChild(document.createTextNode('actual:'));
              value.className = 'value';
              value.appendChild(document.createTextNode(JSON.stringify(event.data.actual)));
              row.appendChild(name);
              row.appendChild(value);
              assert.appendChild(row);
            }
          }
          if (event.at) {
            const row = document.createElement('div'),
              name = document.createElement('span'),
              value = document.createElement('code');
            row.className = 'data';
            name.className = 'name';
            name.appendChild(document.createTextNode('at:'));
            value.className = 'value';
            value.appendChild(document.createTextNode(event.at));
            row.appendChild(name);
            row.appendChild(value);
            assert.appendChild(row);
          }
          {
            const error = event.data && event.data.actual instanceof Error ? event.data.actual : event.marker,
              stack = error && error.stack;
            if (typeof stack == 'string') {
              const row = document.createElement('div'),
                name = document.createElement('span'),
                value = document.createElement('pre');
              row.className = 'data stack';
              name.className = 'name';
              name.appendChild(document.createTextNode('stack:'));
              value.className = 'value';
              stack.split('\n').forEach(line => value.appendChild(document.createTextNode(line + '\n')));
              row.appendChild(name);
              row.appendChild(value);
              assert.appendChild(row);
            }
          }
          this.current.appendChild(assert);
        }
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

export default DomReporter;
