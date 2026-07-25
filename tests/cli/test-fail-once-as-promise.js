import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import test from '../../index.js';

const run = promisify(execFile);

const root = fileURLToPath(new URL('../../', import.meta.url)),
  fixtures = [
    'tests/cli/fixtures/fail-once/late-failure.js',
    'tests/cli/fixtures/fail-once/pass-a.js',
    'tests/cli/fixtures/fail-once/pass-b.js'
  ];

// Regression test for the fail-once StopTest leak: a failing assert inside an
// asPromise async body rejects with the runner's own StopTest sentinel. Under
// the parallel runner that rejection must be handled — before the fix it killed
// the worker, minted a phantom `operator: error` failure carrying the serialized
// sentinel, and dropped the final summary.
test(
  'failOnce with an asPromise late failure under the parallel runner',
  {timeout: 15000},
  async t => {
    const isDeno = typeof Deno == 'object',
      cmd = isDeno ? Deno.execPath() : process.execPath,
      args = isDeno
        ? ['run', '-A', 'bin/tape6.js', '--flags', 'FO', ...fixtures]
        : ['bin/tape6.js', '--flags', 'FO', ...fixtures],
      env = {...process.env, NO_COLOR: '1', TAPE6_TAP: '1', TAPE6_PAR: '3'};
    for (const key of Object.keys(env)) {
      if (key.startsWith('TAPE6_') && key !== 'TAPE6_TAP' && key !== 'TAPE6_PAR') delete env[key];
    }
    const result = await run(cmd, args, {cwd: root, env}).catch(error => error);

    t.equal(result.code, 1, 'the run fails with exit code 1');

    const failures = result.stdout.split(/\r?\n/).filter(line => /^not ok \d+/.test(line));
    t.equal(failures.length, 1, 'exactly one failing test point — no phantom failure');
    t.matchString(failures[0] || '', /boom/, 'the real failure is the one reported');
    t.notOk(/^not ok .*StopTest/m.test(result.stdout), 'the sentinel is not recorded as a failure');
    t.matchString(result.stdout, /^# tests \d+$/m, 'the final summary is present');
    t.notOk(result.stderr.includes('StopTest'), 'the sentinel does not leak to stderr');
  }
);
