import {signature} from '../src/State.js';

const formatValue = value => {
  if (typeof value == 'string') return value;
  if (value && value[signature] === signature) {
    value = {...value};
    delete value[signature];
  }
  return JSON.stringify(value);
};

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
        this.current = document.createElement('div');
        this.current.className = 'test running';
        {
          const header = document.createElement('div');
          header.className = 'header';
          if (event.todo) {
            const todo = document.createElement('span');
            todo.className = 'text-todo';
            todo.appendChild(document.createTextNode('TODO'));
            header.appendChild(todo);
            header.appendChild(document.createTextNode(' '));
          }
          header.appendChild(document.createTextNode(event.name));
          this.current.appendChild(header);
        }
        ((this.stack.length && this.stack[this.stack.length - 1]) || this.root).appendChild(
          this.current
        );
        break;
      case 'end':
        if (this.current) {
          this.current.classList.remove('running');
          this.current.classList.add(event.fail ? 'failed' : 'passed');
        }
        this.current = this.stack.pop();
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
          if (event.skip) {
            const node = document.createElement('span');
            node.className = 'text-skipped';
            node.appendChild(document.createTextNode('SKIP'));
            header.appendChild(node);
            header.appendChild(document.createTextNode(' '));
          }
          if (event.todo) {
            const node = document.createElement('span');
            node.className = 'text-todo';
            node.appendChild(document.createTextNode('TODO'));
            header.appendChild(node);
            header.appendChild(document.createTextNode(' '));
          }
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
          const expected = event.expected && JSON.parse(event.expected);
          if (event.hasOwnProperty('expected')) {
            const row = document.createElement('div'),
              name = document.createElement('span'),
              value = document.createElement('code');
            row.className = 'data';
            name.className = 'name';
            name.appendChild(document.createTextNode('expected:'));
            value.className = 'value';
            value.appendChild(document.createTextNode(formatValue(expected)));
            row.appendChild(name);
            row.appendChild(value);
            assert.appendChild(row);
          }
          const actual = event.actual && JSON.parse(event.actual);
          if (event.hasOwnProperty('actual')) {
            const row = document.createElement('div'),
              name = document.createElement('span'),
              value = document.createElement('code');
            row.className = 'data';
            name.className = 'name';
            name.appendChild(document.createTextNode('actual:'));
            value.className = 'value';
            value.appendChild(document.createTextNode(formatValue(actual)));
            row.appendChild(name);
            row.appendChild(value);
            assert.appendChild(row);
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
            const stack =
              actual?.type === 'Error' && typeof actual.stack == 'string'
                ? actual.stack
                : event.marker.stack;
            if (typeof stack == 'string') {
              const row = document.createElement('div'),
                name = document.createElement('span'),
                value = document.createElement('pre');
              row.className = 'data stack';
              name.className = 'name';
              name.appendChild(document.createTextNode('stack:'));
              value.className = 'value';
              stack
                .split('\n')
                .forEach(line => value.appendChild(document.createTextNode(line + '\n')));
              row.appendChild(name);
              row.appendChild(value);
              assert.appendChild(row);
            }
          }
          (this.current || this.root).appendChild(assert);
        }
        break;
    }
  }
}

export default DomReporter;
