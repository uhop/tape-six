import test from '../index.js';
import TapReporter from '../src/reporters/TapReporter.js';
import TTYReporter from '../src/reporters/TTYReporter.js';
import {getErrorChain} from '../src/State.js';

const captureTap = () => {
  const lines = [];
  return {lines, write: text => lines.push(text)};
};

const captureTty = () => {
  const lines = [];
  return {
    lines,
    output: {isTTY: false, write: text => lines.push(text.replace(/\n$/, ''))}
  };
};

const failWith = (reporter, error) => {
  reporter.report({type: 'test', test: 0});
  reporter.report(
    {
      type: 'assert',
      name: 'UNEXPECTED EXCEPTION: ' + String(error),
      test: 0,
      operator: 'exception',
      fail: true,
      marker: new Error(),
      data: {actual: error}
    },
    true
  );
};

test('TAP renders the cause chain with the root stack', t => {
  const {lines, write} = captureTap();
  const reporter = new TapReporter({write, useJson: true});
  const root = new Error('root boom');
  failWith(reporter, new Error('outer', {cause: new Error('middle', {cause: root})}));
  t.ok(lines.includes('  causes:'), 'the causes block is present');
  t.ok(
    lines.includes('    - "Error: middle"') && lines.includes('    - "Error: root boom"'),
    'every cause link is labeled, outermost to root'
  );
  t.ok(lines.includes('  causeStack:'), 'the root cause stack is present');
  t.ok(
    lines.some(line => /^ {4}- "at /.test(line)),
    'cause stack frames are quoted list entries'
  );
  t.matchString(
    lines.find(line => line.startsWith('  actual:')),
    /"cause":/,
    'the serialized actual carries the nested cause'
  );
});

test('TAP renders AggregateError members', t => {
  const {lines, write} = captureTap();
  const reporter = new TapReporter({write, useJson: true});
  failWith(
    reporter,
    new AggregateError([new TypeError('first'), new RangeError('second')], 'both failed')
  );
  t.ok(lines.includes('  errors:'), 'the errors block is present');
  t.ok(
    lines.includes('    - "TypeError: first"') && lines.includes('    - "RangeError: second"'),
    'every member is labeled'
  );
});

test('TAP renders a fetch-style chain (cause is an AggregateError)', t => {
  const {lines, write} = captureTap();
  const reporter = new TapReporter({write, useJson: true});
  failWith(
    reporter,
    new TypeError('fetch failed', {
      cause: new AggregateError([new Error('ECONNREFUSED ::1:80')], 'connect failed')
    })
  );
  t.ok(lines.includes('    - "AggregateError: connect failed"'), 'the cause link is labeled');
  t.ok(lines.includes('    - "Error: ECONNREFUSED ::1:80"'), 'nested members are collected');
});

test('a cyclic cause chain terminates and is marked circular', t => {
  const {lines, write} = captureTap();
  const reporter = new TapReporter({write, useJson: true});
  const a = new Error('a'),
    b = new Error('b');
  a.cause = b;
  b.cause = a;
  t.doesNotThrow(() => failWith(reporter, a));
  t.ok(lines.includes('    - "Error: b"'), 'the first link is labeled');
  t.matchString(
    lines.find(line => line.startsWith('  actual:')),
    /"Circular"/,
    'the cycle is broken with a circular marker'
  );
});

test('non-Error causes are rendered as-is and end the chain', t => {
  const {lines, write} = captureTap();
  const reporter = new TapReporter({write, useJson: true});
  failWith(reporter, new Error('outer', {cause: 'plain reason'}));
  t.ok(lines.includes('    - "plain reason"'), 'a string cause is shown verbatim');
  t.notOk(lines.includes('  causeStack:'), 'no stack without an Error root');
});

test('TTY renders the cause chain', t => {
  const {lines, output} = captureTty();
  const reporter = new TTYReporter({output, hasColors: false, showBanner: false});
  failWith(reporter, new Error('outer', {cause: new Error('root boom')}));
  t.ok(
    lines.some(line => line.includes('cause: Error: root boom')),
    'the cause line is present'
  );
  t.ok(
    lines.some(line => line.includes('cause stack: |-')),
    'the root cause stack is present'
  );
});

test('getErrorChain ignores non-serialized values', t => {
  t.equal(getErrorChain(null), null);
  t.equal(getErrorChain('text'), null);
  t.equal(getErrorChain({type: 'Error', message: 'unsigned'}), null, 'no signature, no chain');
  t.equal(
    getErrorChain(JSON.parse(JSON.stringify({message: 'x'}))),
    null,
    'plain objects are not chains'
  );
});
