import test from '../../index.js';

import {RUNNERS, runSuite} from './helpers/run-suite.js';

const dir = 'tests/cli/fixtures/fake-timers/',
  // a run past this has hung
  CAP = 15000,
  MODES = [...RUNNERS, {label: 'direct', bin: null}];

// Deno's mock.timers stops a timer held from before it too (Deno 2.9.8, 2026-11-09), so nothing
// in plain JavaScript reaches a working timer there; tape-six's own timers hold the real ones on
// Node and Bun.
const skip = typeof Deno == 'object';

// the timeout raced the body on the global setTimeout, which the test had faked
test('a test that fakes timers still times out', {timeout: 120000, skip}, async t => {
  for (const mode of MODES) {
    const {code, stdout, killed} = await runSuite({
      bin: mode.bin,
      files: [dir + 'fakes-and-never-settles.js'],
      flags: '',
      par: 1,
      timeout: CAP
    });
    t.notOk(killed, `${mode.label}: ends`);
    t.equal(code, 1, `${mode.label}: exits 1`);
    t.matchString(stdout, /Timed out after 200ms/, `${mode.label}: reports the timeout`);
    t.matchString(stdout, /^ok \d+ next test/m, `${mode.label}: runs the next test`);
  }
});

// a worker cleared its start timer with the faked clearTimeout, so it fired on a healthy file
test('a file that fakes timers at load passes', {timeout: 60000, skip}, async t => {
  for (const runner of RUNNERS) {
    const {code, stdout} = await runSuite({
      bin: runner.bin,
      files: [dir + 'fakes-at-load.js'],
      flags: '',
      par: 1,
      env: {TAPE6_WORKER_START_TIMEOUT: '300'},
      timeout: CAP
    });
    t.equal(code, 0, `${runner.label}: exits 0`);
    t.notOk(/No tests found/.test(stdout), `${runner.label}: the start timer stays quiet`);
  }
});
