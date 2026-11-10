import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import test from '../../index.js';

import {PARALLEL, PROC, RUNNERS, runSuite} from './helpers/run-suite.js';

const dir = 'tests/cli/fixtures/abandon/',
  // a run past this has hung
  CAP = 15000,
  MODES = [...RUNNERS, {label: 'direct', bin: null}];

const runMode = (mode, files, flags, par = 1) =>
  runSuite({
    bin: mode.bin,
    files,
    flags,
    par,
    env: {TAPE6_GRACE_TIMEOUT: '1000'},
    timeout: CAP
  });

// how each runtime reports a rejection with no reason: Bun does not wrap it as Node does
const UNHANDLED_REJECTION =
  typeof Bun == 'object'
    ? /error: undefined|\[object ErrorEvent\]/
    : /UnhandledPromiseRejection|ERR_UNHANDLED_REJECTION|Uncaught \(in promise\)/;

// a runtime colors its own crash report when the suite runs under FORCE_COLOR
const plain = text => text.replace(/\x1b\[[0-9;]*m/g, '');

const failedOnce = stdout => /^# fail {2}1$/m.test(stdout);

// an assert in a callback after a fail-once stop threw StopTest past every handler: the
// worker or child crashed, the crash counted as a second failure, and afterAll never ran
test('a body that fails in a callback ends cleanly under fail-once', {timeout: 120000}, async t => {
  for (const mode of MODES) {
    for (const file of ['fails-before-resolve.js', 'fails-after-resolve.js']) {
      const label = `${mode.label}, ${file}`,
        {code, stdout, killed} = await runMode(mode, [dir + file], 'O');
      t.notOk(killed, `${label}: ends`);
      t.equal(code, 1, `${label}: exits 1`);
      t.ok(failedOnce(stdout), `${label}: counts one failure`);
      t.matchString(stdout, /MARK afterAll/, `${label}: runs afterAll`);
    }
  }
});

// the failing file waits for the sibling's test to start: a stop that lands before it
// rightly runs neither its test nor its hooks, and CI landed it there
test('a body stopped by a failing sibling ends cleanly', {timeout: 60000}, async t => {
  for (const mode of [
    {label: 'parallel', bin: PARALLEL},
    {label: 'proc runner', bin: PROC}
  ]) {
    const tempDir = mkdtempSync(join(tmpdir(), 'tape6-abandon-'));
    try {
      const {code, stdout, killed} = await runSuite({
        bin: mode.bin,
        files: [dir + 'fails-now.js', dir + 'asserts-later.js'],
        flags: 'O',
        par: 2,
        env: {TAPE6_GRACE_TIMEOUT: '1000', SIBLING_STARTED: join(tempDir, 'started')},
        timeout: CAP
      });
      t.notOk(killed, `${mode.label}: ends`);
      t.equal(code, 1, `${mode.label}: exits 1`);
      t.ok(failedOnce(stdout), `${mode.label}: counts one failure`);
      t.matchString(stdout, /MARK afterAll/, `${mode.label}: runs the sibling's afterAll`);
    } finally {
      rmSync(tempDir, {recursive: true, force: true});
    }
  }
});

// the drain unwinds a body stopped at its own assert before the hooks run
test('a stopped body runs its finally before afterAll', {timeout: 60000}, async t => {
  for (const mode of MODES) {
    const {code, stdout} = await runMode(mode, [dir + 'finally-first.js'], 'O');
    t.equal(code, 1, `${mode.label}: exits 1`);
    t.matchString(stdout, /MARK finally[\s\S]*MARK afterAll/, `${mode.label}: finally first`);
  }
});

// the timeout reported the failure, then waited for the body forever
test('a body past its timeout is abandoned', {timeout: 120000}, async t => {
  for (const mode of MODES) {
    const {code, stdout, killed} = await runMode(mode, [dir + 'never-settles.js'], '');
    t.notOk(killed, `${mode.label}: ends`);
    t.equal(code, 1, `${mode.label}: exits 1`);
    t.matchString(stdout, /Timed out after 100ms/, `${mode.label}: reports the timeout`);
    t.matchString(stdout, /^ok \d+ next test/m, `${mode.label}: runs the next test`);
    t.matchString(stdout, /MARK afterAll/, `${mode.label}: runs afterAll`);
  }
});

test('an abandoned parent ends its embedded test first', {timeout: 120000}, async t => {
  for (const mode of MODES) {
    const {code, stdout, killed} = await runMode(mode, [dir + 'nested-never-settles.js'], '');
    t.notOk(killed, `${mode.label}: ends`);
    t.equal(code, 1, `${mode.label}: exits 1`);
    t.matchString(
      stdout,
      /# finish: child[\s\S]*# finish: parent[\s\S]*# start: runs after it/,
      `${mode.label}: closes the scopes in order`
    );
    t.matchString(stdout, /^ok \d+ next test/m, `${mode.label}: runs the next test`);
  }
});

// a late assert was counted under the test running then, with no sign of its own test
test('a late assert names the test it came from', {timeout: 60000}, async t => {
  for (const mode of MODES) {
    const {code, stdout} = await runMode(mode, [dir + 'late-assert.js'], '');
    t.equal(code, 1, `${mode.label}: exits 1`);
    t.matchString(
      stdout,
      /^not ok \d+ LATE \(from "first"\): late failure/m,
      `${mode.label}: labels it`
    );
  }
});

// the handler for a stray StopTest must leave every other error as it was
test('an error the file handles itself is seen once', {timeout: 60000}, async t => {
  for (const mode of MODES.filter(mode => mode.bin !== RUNNERS[1].bin)) {
    const {code, stdout} = await runMode(mode, [dir + 'handles-own-error.js'], '');
    t.equal(code, 0, `${mode.label}: exits 0`);
    t.equal(stdout.match(/MARK own listener: handled/g)?.length, 1, `${mode.label}: seen once`);
  }
});

test('any other uncaught error fails its file as before', {timeout: 60000}, async t => {
  for (const mode of MODES) {
    const thrown = await runMode(mode, [dir + 'throws-in-callback.js'], '');
    t.equal(thrown.code, 1, `${mode.label}, thrown: exits 1`);
    t.matchString(
      thrown.stdout + thrown.stderr,
      /thrown in a callback/,
      `${mode.label}, thrown: shows it`
    );
    const rejected = await runMode(mode, [dir + 'rejects-with-nothing.js'], '');
    t.equal(rejected.code, 1, `${mode.label}, rejected: exits 1`);
    t.matchString(
      plain(rejected.stdout + rejected.stderr),
      UNHANDLED_REJECTION,
      `${mode.label}, rejected: reports it as the runtime does`
    );
  }
});

// an abandoned body's t.test() opened its scope inside the next test, which lost its own
test('an abandoned body cannot start an embedded test', {timeout: 60000}, async t => {
  for (const mode of MODES) {
    const {code, stdout} = await runMode(mode, [dir + 'late-embedded-test.js'], '');
    t.equal(code, 1, `${mode.label}: exits 1`);
    t.notOk(/late child passes/.test(stdout), `${mode.label}: the late child does not run`);
    t.matchString(
      stdout,
      /# start: second\r?\n(?:(?!# start:).*\r?\n)*?ok \d+ second passes[\s\S]*# finish: second[\s\S]*# start: third/,
      `${mode.label}: the next test keeps its scope`
    );
    t.matchString(stdout, /^# tests \d+$/m, `${mode.label}: reports a summary`);
  }
});
