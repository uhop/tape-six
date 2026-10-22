import test from '../../index.js';

import {PARALLEL, RUNNERS, runSuite} from './helpers/run-suite.js';

const PASS_B = 'tests/cli/fixtures/exit-code/passing-b.js',
  UNRESPONSIVE = 'tests/cli/fixtures/force-kill/unresponsive.js',
  QUIET_DRAIN = 'tests/cli/fixtures/deadline/quiet-drain.js',
  NEXT_FILE = /^# start: FILE: \/tests[\\/]cli[\\/]fixtures[\\/]exit-code[\\/]passing-b\.js$/m;

const countLines = (text, re) => text.split(/\r?\n/).filter(line => re.test(line)).length;

// A deadline caps one runaway file. However its worker stops, that file fails
// once and the files queued behind it still run. A drained worker used to
// report nothing, and its stop marks cancelled the queue: exit 1 under `# ok`.
// With 2 s to spare the queued file has room to finish, so that case requires
// it to pass; at 400 ms a loaded machine can start it late enough to reach its
// own deadline.
const DEADLINE_CASES = [
  {label: 'drains', files: [QUIET_DRAIN, PASS_B], deadline: 400},
  {
    label: 'drains, with time to spare for the next file',
    files: [QUIET_DRAIN, PASS_B],
    deadline: 2000,
    strict: true
  },
  {label: 'is stopped before its test starts', files: [QUIET_DRAIN, PASS_B], deadline: 1},
  {label: 'is force-killed', files: [UNRESPONSIVE, PASS_B], deadline: 400, killed: true}
];

const runDeadline = (bin, files, deadline, extra = {}) =>
  runSuite({
    bin,
    files,
    flags: 'F',
    par: 1,
    ...extra,
    env: {TAPE6_WORKER_TIMEOUT: String(deadline), TAPE6_GRACE_TIMEOUT: '300', ...extra.env}
  });

const deadlineFailures = (stdout, deadline) => {
  const re = new RegExp(`^not ok \\d+ Terminated after ${deadline}ms`),
    [capped, ...rest] = stdout.split(NEXT_FILE),
    queued = rest.join('\n');
  return {
    capped: countLines(capped, re),
    queued: countLines(queued, re),
    queuedAny: countLines(queued, /^not ok /)
  };
};

// the runs are independent, and most of each one is a deadline or a grace window
test('a worker deadline fails its own file in every mode', {timeout: 120000}, async t => {
  const plan = [];
  for (const runner of RUNNERS) {
    for (const testCase of DEADLINE_CASES) {
      if (testCase.killed && runner.inProcess) continue;
      plan.push({
        label: `${runner.label}, a file that ${testCase.label}`,
        deadline: testCase.deadline,
        strict: testCase.strict,
        pending: runDeadline(runner.bin, testCase.files, testCase.deadline)
      });
    }
    plan.push({
      label: `${runner.label}, failOnce`,
      deadline: 400,
      failOnce: true,
      pending: runDeadline(runner.bin, [QUIET_DRAIN, PASS_B], 400, {flags: 'FO'})
    });
  }
  const tty = runDeadline(PARALLEL, [QUIET_DRAIN, PASS_B], 2000, {env: {TAPE6_TAP: ''}});

  for (const {label, deadline, strict, failOnce, pending} of plan) {
    const {code, stdout} = await pending,
      failures = deadlineFailures(stdout, deadline);
    t.equal(code, 1, `${label}: exits 1`);
    t.equal(failures.capped, 1, `${label}: the deadline fails the capped file once`);
    t.matchString(stdout, /^# not ok$/m, `${label}: the trailer agrees with the exit code`);
    if (failOnce) {
      t.notOk(/passing-b\.js/.test(stdout), `${label}: the deadline stops the run`);
      continue;
    }
    t.matchString(stdout, NEXT_FILE, `${label}: the next file still runs`);
    if (strict) {
      t.equal(failures.queuedAny, 0, `${label}: the next file passes`);
    } else {
      t.ok(failures.queued <= 1, `${label}: the queued file fails once at most`);
    }
  }

  t.matchString((await tty).stdout, /\bfailed: 1\b/, 'the TTY summary counts the deadline');
});
