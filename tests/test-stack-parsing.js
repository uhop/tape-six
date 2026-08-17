import test from '../index.js';
import {getStackList, getErrorChain, signature} from '../src/State.js';

// Real `error.stack` captures, one per engine. tape-six's browser suite has only
// ever been verified on headless Chrome, so the V8-only parser went unnoticed
// until 2026-08-16, when Epiphany (WebKitGTK) and Firefox both reported the
// cause-chain test failing: neither format has `at `, so every frame was dropped
// and failures lost their location, stack block and cause stack.
// The format is chosen by the *host*, not the engine — Bun runs JavaScriptCore
// but emits V8-shaped stacks (message line + `    at …`, plus
// Error.captureStackTrace) to stay Node-compatible, while the same engine in
// Safari/Epiphany emits `name@url:line:col`. So `npm run test:bun` looks like
// non-V8 coverage and is not: only a browser exercises the other branch.
const STACKS = {
  // V8-shaped: Node, Deno, Chrome — and Bun
  v8Style: [
    'Error: boom',
    '    at Tester.strictEqual (file:///repo/src/Tester.js:201:15)',
    '    at Object.testFn (file:///repo/tests/test-fail.js:6:5)',
    '    at async Immediate.testRunner (file:///repo/index.js:265:27)'
  ].join('\n'),
  // JavaScriptCore in a browser host, captured from Epiphany
  webKit: [
    'ok@http://localhost:3000/src/Tester.js:142:24',
    '@http://localhost:3000/tests/test-error-chain.js:40:7',
    '@http://localhost:3000/src/test.js:177:31'
  ].join('\n'),
  // SpiderMonkey, captured from Firefox
  firefox: [
    'ok@http://localhost:3000/src/Tester.js:142:15',
    '@http://localhost:3000/tests/test-error-chain.js:40:5',
    'runTests@http://localhost:3000/src/test.js:177:25'
  ].join('\n')
};

test('getStackList parses every engine, not just V8', t => {
  for (const [engine, stack] of Object.entries(STACKS)) {
    const frames = getStackList({stack});
    t.equal(frames.length, 3, engine + ': all three frames are parsed');
    t.matchString(frames[0], /Tester\.js:\d+:\d+/, engine + ': the top frame keeps its location');
  }
});

test('getStackList drops the V8 message line but keeps anonymous frames', t => {
  t.notOk(
    getStackList({stack: STACKS.v8Style}).some(frame => /^Error: boom/.test(frame)),
    'the V8-style message line is not a frame'
  );
  t.equal(
    getStackList({stack: STACKS.webKit})[1],
    '@http://localhost:3000/tests/test-error-chain.js:40:7',
    'an anonymous `@url` frame survives'
  );
  t.deepEqual(
    getStackList({stack: 'ok@[native code]'}),
    ['ok@[native code]'],
    'a native frame survives'
  );
});

// The `@` form is matched on its tail, so a message that merely contains an `@`
// is not mistaken for a frame — V8 keeps the message inside `stack`.
test('an @ in the error message is not a frame', t => {
  t.deepEqual(
    getStackList({stack: 'Error: invalid address user@example.com\n    at foo (file:///a.js:1:1)'}),
    ['foo (file:///a.js:1:1)'],
    'only the real frame is returned'
  );
});

const serializedError = (message, stack, cause) => {
  const error = {type: 'Error', message, stack, name: 'Error', [signature]: signature};
  if (cause) error.cause = cause;
  return error;
};

test('getErrorChain yields a usable cause stack on every engine', t => {
  for (const [engine, stack] of Object.entries(STACKS)) {
    const chain = getErrorChain(
      serializedError('outer', stack, serializedError('root boom', stack))
    );
    t.ok(chain, engine + ': a chain is produced');
    t.equal(chain.causes[0], 'Error: root boom', engine + ': the cause is labeled');
    t.equal(chain.causeStack.length, 3, engine + ': the root stack carries frames');
  }
});
