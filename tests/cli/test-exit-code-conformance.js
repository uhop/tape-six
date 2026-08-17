import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import test from '../../index.js';

const run = promisify(execFile);

const root = fileURLToPath(new URL('../../', import.meta.url)),
  dir = 'tests/cli/fixtures/exit-code/',
  PASS_A = dir + 'passing-a.js',
  PASS_B = dir + 'passing-b.js',
  FAILING = dir + 'failing.js',
  BAIL_OUT = dir + 'bail-out.js',
  LOAD_ERROR = dir + 'load-error.js',
  UNRESPONSIVE = 'tests/cli/fixtures/force-kill/unresponsive.js',
  PARALLEL = 'bin/tape6.js',
  SEQUENTIAL = 'bin/tape6-seq.js';

// Spawns the runner and reports what the operating system saw. The runner
// decides its own verdict, so nothing in-process can stand in for this: the
// 1.16.3 bug reported success through the very path that was broken, and
// tape-six's own suite runs `--flags FO`, so a green run was not proof.
const runSuite = async ({bin, files, flags, par, env: extraEnv}) => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    args = isDeno ? ['run', '-A', bin, ...files] : [bin, ...files],
    env = {...process.env};
  for (const key of Object.keys(env)) {
    if (key.startsWith('TAPE6_')) delete env[key];
  }
  Object.assign(env, {
    NO_COLOR: '1',
    TAPE6_TAP: '1',
    TAPE6_FLAGS: flags,
    TAPE6_PAR: String(par),
    ...extraEnv
  });
  const result = await run(cmd, args, {cwd: root, env}).catch(error => error);
  return {
    code: result.code === undefined ? 0 : result.code,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
};

// Every mode a failing suite can be run in. `parallel + failOnce` is where the
// exit code has actually been wrong — twice (1.16.0, 1.16.3) — and the rest are
// the neighbours that stayed correct while it was broken, which is exactly why
// they belong here: they are what made the fault look like a non-issue.
const FAILING_CASES = [
  {label: 'parallel, no failOnce', bin: PARALLEL, files: [FAILING, PASS_B], flags: 'F', par: 2},
  {label: 'parallel, failOnce', bin: PARALLEL, files: [FAILING, PASS_B], flags: 'FO', par: 2},
  {label: 'single worker, failOnce', bin: PARALLEL, files: [FAILING, PASS_B], flags: 'FO', par: 1},
  {label: 'lone failing file, failOnce', bin: PARALLEL, files: [FAILING], flags: 'FO', par: 2},
  {label: 'bail-out', bin: PARALLEL, files: [BAIL_OUT, PASS_B], flags: 'FO', par: 2},
  {
    label: 'file that fails to load',
    bin: PARALLEL,
    files: [LOAD_ERROR, PASS_B],
    flags: 'FO',
    par: 2
  },
  {
    label: 'sequential runner, failOnce',
    bin: SEQUENTIAL,
    files: [FAILING, PASS_B],
    flags: 'FO',
    par: 1
  },
  // the cell that was actually wrong: a sibling that outlives the drain window
  // has to be force-killed, and the kill used to end the run without a verdict
  {
    label: 'force-killed sibling, failOnce',
    bin: PARALLEL,
    files: [UNRESPONSIVE, FAILING],
    flags: 'FO',
    par: 2,
    env: {TAPE6_GRACE_TIMEOUT: '300'}
  }
];

// The other direction, and not a formality: the belt-and-braces exit guard
// added in 1.16.3 (`worker.stopRequested || …`) fails the run on a signal
// rather than a count, so an over-firing stop would turn every green suite red
// and only these cases would notice.
const PASSING_CASES = [
  {label: 'parallel, failOnce', bin: PARALLEL, files: [PASS_A, PASS_B], flags: 'FO', par: 2},
  {label: 'parallel, no failOnce', bin: PARALLEL, files: [PASS_A, PASS_B], flags: 'F', par: 1},
  {
    label: 'sequential runner, failOnce',
    bin: SEQUENTIAL,
    files: [PASS_A, PASS_B],
    flags: 'FO',
    par: 1
  }
];

// Runs a test file directly, with no runner in front of it — a third surface
// the matrix above cannot reach, since it has no EventServer and computes its
// verdict in index.js.
const runFile = async file => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    args = isDeno ? ['run', '-A', file] : [file],
    env = {...process.env};
  for (const key of Object.keys(env)) {
    if (key.startsWith('TAPE6_')) delete env[key];
  }
  Object.assign(env, {NO_COLOR: '1', TAPE6_TAP: '1'});
  const result = await run(cmd, args, {cwd: root, env}).catch(error => error);
  return {code: result.code === undefined ? 0 : result.code, stdout: result.stdout || ''};
};

// A bail-out aborts the run without failing an assertion, so every verdict
// computed from `failed` alone read it as success: exit 0 with `# ok` under the
// runners, and exit 0 with a green summary on a direct run.
test('a bail-out is reported as a failed run everywhere', {timeout: 30000}, async t => {
  const viaRunner = await runSuite({bin: PARALLEL, files: [BAIL_OUT], flags: '', par: 2});
  t.equal(viaRunner.code, 1, 'the runner exits 1');
  t.matchString(viaRunner.stdout, /^Bail out!/m, 'the bail-out line is emitted');
  t.matchString(viaRunner.stdout, /^# not ok$/m, 'the TAP trailer agrees with the exit code');
  t.notOk(/^# ok$/m.test(viaRunner.stdout), 'and does not also claim ok');

  // the TTY reporter carries per-test verdicts, and failure-only mode decides
  // what to print from the same flag — so a green bail-out was also an invisible one
  const tty = await runSuite({
    bin: PARALLEL,
    files: [BAIL_OUT],
    flags: 'F',
    par: 2,
    env: {TAPE6_TAP: ''}
  });
  t.matchString(tty.stdout, /✗ bails out/, 'the aborted test renders as failed under failure-only');

  const direct = await runFile(BAIL_OUT);
  t.equal(direct.code, 1, 'a directly-run file exits 1 too');
});

test('a failing suite exits 1 in every mode', {timeout: 60000}, async t => {
  for (const testCase of FAILING_CASES) {
    const {code, stdout} = await runSuite(testCase);
    t.equal(code, 1, `${testCase.label}: exits 1`);
    // the 1.16.3 symptom was exit 0 *and* zero output; a run that fails
    // silently is still broken, so assert the report survived the verdict
    t.ok(stdout.trim().length > 0, `${testCase.label}: reports something`);
  }
});

test('a passing suite exits 0 in every mode', {timeout: 60000}, async t => {
  for (const testCase of PASSING_CASES) {
    const {code, stdout} = await runSuite(testCase);
    t.equal(code, 0, `${testCase.label}: exits 0`);
    t.matchString(stdout, /^# tests \d+$/m, `${testCase.label}: reports a summary`);
  }
});
