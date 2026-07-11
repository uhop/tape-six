import test from '../index.js';
import TapReporter from '../src/reporters/TapReporter.js';
import {signature} from '../src/State.js';

const capture = () => {
  const lines = [];
  return {lines, write: text => lines.push(text)};
};

test('TapReporter survives a failing assert without stackList', t => {
  const {lines, write} = capture();
  const reporter = new TapReporter({write, useJson: true});
  t.doesNotThrow(() =>
    reporter.report({
      type: 'assert',
      id: 1,
      fail: true,
      todo: true,
      name: 'todo failure',
      operator: 'fail',
      diffTime: 0.1
    })
  );
  t.ok(
    lines.some(line => line.startsWith('not ok 1 # TODO')),
    'the test point is written'
  );
  t.notOk(
    lines.some(line => line.startsWith('  stack:')),
    'no stack section without stackList'
  );
  t.equal(lines[lines.length - 1], '  ...', 'the diagnostic block is closed');
});

test('TapReporter emits the SKIP directive for skipped asserts', t => {
  const {lines, write} = capture();
  const reporter = new TapReporter({write, useJson: true});
  reporter.report({type: 'assert', id: 1, skip: true, name: 'skipped', diffTime: 0});
  t.ok(
    lines.some(line => /^ok 1 # SKIP skipped/.test(line)),
    'the directive is present'
  );
});

test('TapReporter renumbers asserts when asked', t => {
  const {lines, write} = capture();
  const reporter = new TapReporter({write, useJson: true, renumberAsserts: true});
  for (const id of [1, 2, 1]) {
    reporter.report({type: 'assert', id, name: 'assert ' + id, diffTime: 0});
  }
  const ids = lines.filter(line => line.startsWith('ok')).map(line => +line.split(' ')[1]);
  t.deepEqual(ids, [1, 2, 3], 'ids are sequential regardless of event ids');
});

test('TapReporter strips the internal signature from diagnostics', t => {
  const {lines, write} = capture();
  const reporter = new TapReporter({write, useJson: true});
  const actual = JSON.stringify({type: 'Error', message: 'boom', [signature]: signature});
  reporter.report({
    type: 'assert',
    id: 1,
    fail: true,
    name: 'exception shown',
    operator: 'exception',
    actual,
    stackList: ['somewhere (file:///x.js:1:1)'],
    diffTime: 0
  });
  const actualLine = lines.find(line => line.trimStart().startsWith('actual:'));
  t.ok(actualLine, 'the actual line is present');
  t.notOk(actualLine.includes(signature), 'the signature key is stripped');
  t.ok(
    lines.includes('    - "at somewhere (file:///x.js:1:1)"'),
    'stack frames are quoted list items'
  );
});
