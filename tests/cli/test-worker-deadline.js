import test from '../../index.js';

import {PARALLEL, RUNNERS, runSuite} from './helpers/run-suite.js';

const PASS_B = 'tests/cli/fixtures/exit-code/passing-b.js',
  UNRESPONSIVE = 'tests/cli/fixtures/force-kill/unresponsive.js',
  QUIET_DRAIN = 'tests/cli/fixtures/deadline/quiet-drain.js',
  SLOW_START = 'tests/cli/fixtures/deadline/slow-start.js';

const countLines = (text, re) => text.split(/\r?\n/).filter(line => re.test(line)).length;

// A TAP report by file, from each `# start: FILE:` line to its `# finish: FILE:`;
// what falls outside every file is filed under ''.
const byFile = stdout => {
  const sections = {'': ''};
  let current = '';
  for (const line of stdout.split(/\r?\n/)) {
    const start = /^# start: FILE: \/(.*)$/.exec(line);
    if (start) {
      current = start[1].replace(/\\/g, '/');
      sections[current] ??= '';
      continue;
    }
    if (/^# finish: FILE: /.test(line)) {
      current = '';
      continue;
    }
    sections[current] += line + '\n';
  }
  return sections;
};

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
  {label: 'is force-killed', files: [UNRESPONSIVE, PASS_B], deadline: 400, killed: true},
  {
    label: 'is killed before it reports anything',
    files: [SLOW_START, PASS_B],
    deadline: 100,
    killed: true
  }
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

// the runs are independent, and most of each one is a deadline or a grace window
test('a worker deadline fails its own file in every mode', {timeout: 120000}, async t => {
  const plan = [];
  for (const runner of RUNNERS) {
    for (const testCase of DEADLINE_CASES) {
      if (testCase.killed && runner.inProcess) continue;
      plan.push({
        label: `${runner.label}, a file that ${testCase.label}`,
        files: testCase.files,
        deadline: testCase.deadline,
        strict: testCase.strict,
        pending: runDeadline(runner.bin, testCase.files, testCase.deadline)
      });
    }
    plan.push({
      label: `${runner.label}, failOnce`,
      files: [QUIET_DRAIN, PASS_B],
      deadline: 400,
      failOnce: true,
      pending: runDeadline(runner.bin, [QUIET_DRAIN, PASS_B], 400, {flags: 'FO'})
    });
  }
  const tty = runDeadline(PARALLEL, [QUIET_DRAIN, PASS_B], 2000, {env: {TAPE6_TAP: ''}});

  for (const {label, files, deadline, strict, failOnce, pending} of plan) {
    const {code, stdout} = await pending,
      [capped, next] = files,
      sections = byFile(stdout),
      re = new RegExp(`^not ok \\d+ Terminated after ${deadline}ms`);
    t.equal(code, 1, `${label}: exits 1`);
    t.equal(countLines(sections[''], re), 0, `${label}: every deadline failure names its file`);
    t.equal(
      countLines(sections[capped] ?? '', re),
      1,
      `${label}: the deadline fails the capped file once`
    );
    t.matchString(stdout, /^# not ok$/m, `${label}: the trailer agrees with the exit code`);
    if (failOnce) {
      t.notOk(/passing-b\.js/.test(stdout), `${label}: the deadline stops the run`);
      continue;
    }
    t.ok(next in sections, `${label}: the next file still runs`);
    if (strict) {
      t.equal(countLines(sections[next] ?? '', /^not ok /), 0, `${label}: the next file passes`);
    } else {
      // at a short deadline a loaded machine can start the next file late enough to reach its own
      t.ok(countLines(sections[next] ?? '', re) <= 1, `${label}: the next file fails once at most`);
    }
  }

  t.matchString((await tty).stdout, /\bfailed: 1\b/, 'the TTY summary counts the deadline');
});
