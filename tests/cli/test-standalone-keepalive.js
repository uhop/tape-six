import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import test from '../../index.js';

const run = promisify(execFile);

const fixture = fileURLToPath(new URL('./fixtures/standalone-keepalive.js', import.meta.url));

// bare run, no runner: before the testRunner keep-alive a wait on an unref'd
// timer drained the loop — exit 0 mid-suite, no summary
test('standalone run survives a wait on an unrefd timer', {timeout: 15000}, async t => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    args = isDeno ? ['run', '-A', fixture] : [fixture],
    env = {...process.env, NO_COLOR: '1'};
  for (const key of Object.keys(env)) {
    if (key.startsWith('TAPE6_')) delete env[key];
  }
  const {stdout} = await run(cmd, args, {env});
  t.matchString(stdout, /suite reached the end/, 'the last test ran');
  t.matchString(stdout, /tests: 3/, 'the summary is complete');
});
