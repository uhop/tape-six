import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import test from '../../index.js';
import {signature} from '../../src/State.js';

const run = promisify(execFile);

const fixture = fileURLToPath(new URL('./fixtures/tap-conformance.js', import.meta.url));

// bare TAP run: the stream must stay machine-parseable — sequential test-point
// ids, a plan matching the count, no truncation on todo failures, no style or
// internal-signature leakage
test('TAP stream is conformant', {timeout: 15000}, async t => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    args = isDeno ? ['run', '-A', fixture] : [fixture],
    env = {...process.env, NO_COLOR: '1', TAPE6_TAP: '1'};
  for (const key of Object.keys(env)) {
    if (key.startsWith('TAPE6_') && key !== 'TAPE6_TAP') delete env[key];
  }
  const {stdout} = await run(cmd, args, {env}).catch(error => error);

  const lines = stdout.split(/\r?\n/);
  t.equal(lines[0], 'TAP version 13', 'the version line leads and carries no style suffix');

  const points = lines.filter(line => /^(not )?ok \d+/.test(line)),
    ids = points.map(line => +/^(?:not )?ok (\d+)/.exec(line)[1]);
  t.deepEqual(
    ids,
    Array.from({length: ids.length}, (_, index) => index + 1),
    'test-point ids are sequential'
  );

  const plan = lines.find(line => /^1\.\.\d+$/.test(line));
  t.ok(plan, 'the plan line is present and clean');
  plan && t.equal(+plan.slice(3), ids.length, 'the plan matches the test-point count');

  t.matchString(stdout, /^not ok \d+ # TODO/m, 'the todo failure is reported, not fatal');
  t.matchString(stdout, /^# SKIP test: /m, 'the skipped subtest is noted as a comment');
  t.matchString(stdout, /still running/, 'the suite ran to completion after the todo failure');
  t.matchString(stdout, /^# tests \d+$/m, 'the summary is complete');
  t.doesNotMatchString(
    stdout,
    new RegExp(signature.replace(/[!@#$%^&*]/g, '\\$&')),
    'no internal signature leaks'
  );
});
