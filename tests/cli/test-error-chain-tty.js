import test from '../../index.js';
import TTYReporter from '../../src/reporters/TTYReporter.js';

// CLI-only: TTYReporter imports node:process, so this can't ride in the
// general set — the TAP/getErrorChain half lives in tests/test-error-chain.js

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
