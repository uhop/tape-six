import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import test from '../../index.js';

const run = promisify(execFile);

const root = fileURLToPath(new URL('../../', import.meta.url)),
  unresponsive = 'tests/cli/fixtures/force-kill/unresponsive.js',
  quickFailure = 'tests/cli/fixtures/force-kill/quick-failure.js';

const runFixtures = (fixtures, extraEnv = {}) => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    args = isDeno
      ? ['run', '-A', 'bin/tape6.js', '--flags', 'FO', ...fixtures]
      : ['bin/tape6.js', '--flags', 'FO', ...fixtures],
    env = {...process.env};
  for (const key of Object.keys(env)) {
    if (key.startsWith('TAPE6_')) delete env[key];
  }
  Object.assign(env, {
    NO_COLOR: '1',
    TAPE6_TAP: '1',
    TAPE6_PAR: '2',
    TAPE6_GRACE_TIMEOUT: '300',
    ...extraEnv
  });
  return run(cmd, args, {cwd: root, env}).catch(error => error);
};

// Regression test for the `--flags O` false pass: when failOnce aborted a run,
// a sibling that ignored the terminate was force-killed after graceTimeout
// without ever closing its task. The run then never completed — the process
// exited 0 with the failing worker's events still buffered in a retained lane,
// printing nothing at all.
test(
  'failOnce with a force-killed sibling under the parallel runner',
  {timeout: 15000},
  async t => {
    const result = await runFixtures([unresponsive, quickFailure]);

    t.equal(result.code, 1, 'the run fails with exit code 1');

    const failures = result.stdout.split(/\r?\n/).filter(line => /^not ok \d+/.test(line));
    t.equal(failures.length, 1, 'the buffered failure is flushed, exactly once');
    t.matchString(failures[0] || '', /boom/, 'the real failure is the one reported');
    t.matchString(
      result.stdout,
      /^# tests \d+$/m,
      'the force-kill still unwinds to a final summary'
    );
  }
);

// The per-worker deadline force-kills the same way, but with no failure of its
// own to carry the verdict: unreported, the hung file exits 0.
test('workerTimeout reports the kill as a failure', {timeout: 15000}, async t => {
  const result = await runFixtures([unresponsive], {TAPE6_WORKER_TIMEOUT: '400'});

  t.equal(result.code, 1, 'the run fails with exit code 1');
  t.matchString(result.stdout, /^not ok \d+ Terminated after 400ms/m, 'the deadline is reported');
  t.matchString(result.stdout, /^# tests \d+$/m, 'the summary survives the kill');
});
