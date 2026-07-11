import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import test from '../../index.js';

const run = promisify(execFile);

// the visual demo lives in tests/manual/test-console.js — this spawns it as a
// fixture so console interception stays covered without noisy suite output
const fixture = fileURLToPath(new URL('../manual/test-console.js', import.meta.url));

test('console interception routes verbs through the reporter', {timeout: 15000}, async t => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    args = isDeno ? ['run', '-A', fixture] : [fixture],
    env = {...process.env, NO_COLOR: '1', TAPE6_TAP: '1'};
  for (const key of Object.keys(env)) {
    if (key.startsWith('TAPE6_') && key !== 'TAPE6_TAP') delete env[key];
  }
  const {stdout} = await run(cmd, args, {env});
  t.matchString(stdout, /^# log: log #1$/m, 'console.log is captured');
  t.matchString(stdout, /^# error: error #1$/m, 'console.error is captured');
  t.matchString(
    stdout,
    /^# assert: Assertion failed, value is false$/m,
    'console.assert is captured'
  );
  t.matchString(stdout, /^# tests 2$/m, 'the demo suite passes');
});
