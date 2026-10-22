import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

import test from '../../index.js';

const root = fileURLToPath(new URL('../../', import.meta.url)),
  dir = 'tests/cli/fixtures/proc/';

const runtimeArgs = process.versions.deno ? ['run', '-A'] : process.versions.bun ? ['run'] : [];
// Deno children don't inherit the parent's permissions
const childArgs = process.versions.deno ? ['-r', '-A'] : [];

const runProc = (files, extraEnv) =>
  new Promise((resolve, reject) => {
    // the nested runner must not inherit this worker's TAPE6_* settings
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('TAPE6_'))
    );
    const child = spawn(
      process.execPath,
      [...runtimeArgs, path.join(root, 'bin/tape6-proc.js'), ...childArgs, '--par', '2', ...files],
      {cwd: root, env: {...env, ...extraEnv}, stdio: ['ignore', 'pipe', 'pipe']}
    );
    let output = '';
    child.stdout.on('data', chunk => (output += chunk));
    child.stderr.on('data', chunk => (output += chunk));
    child.on('error', reject);
    child.on('close', code => resolve({code, output: output.replace(/\x1b\[[0-9;]*m/g, '')}));
  });

test('a crash queued behind a failing file keeps the run failed', {timeout: 30_000}, async t => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'tape6-proc-'));
  try {
    const {code, output} = await runProc([dir + 'fail-and-hold.js', dir + 'crash-in-test.js'], {
      CRASH_MARKER: path.join(tempDir, 'failed')
    });
    t.equal(code, 1, 'exit status');
    t.matchString(output, /tests: \d+, asserts: \d+, passed: \d+, failed: 2\b/, 'summary');
  } finally {
    rmSync(tempDir, {recursive: true, force: true});
  }
});

test('a worker that exits 0 at its deadline fails the run', {timeout: 30_000}, async t => {
  const {code, output} = await runProc([dir + 'exit-on-stop.js'], {
    TAPE6_WORKER_TIMEOUT: '300'
  });
  t.equal(code, 1, 'exit status');
  t.matchString(output, /process has failed, timed out/, 'failure');
  t.matchString(output, /tests: \d+, asserts: \d+, passed: \d+, failed: 1\b/, 'summary');
});

test('a worker that exits 0 with a test open fails the run', {timeout: 30_000}, async t => {
  const {code, output} = await runProc([dir + 'exit-mid-test.js']);
  t.equal(code, 1, 'exit status');
  t.matchString(output, /process has failed, exited mid-test/, 'failure');
  t.matchString(output, /tests: \d+, asserts: \d+, passed: \d+, failed: 1\b/, 'summary');
});

test('a file with no tests still passes', {timeout: 30_000}, async t => {
  const {code, output} = await runProc([dir + 'no-tests.js']);
  t.equal(code, 0, 'exit status');
  t.matchString(output, /tests: 0, asserts: 0, passed: 0, failed: 0\b/, 'summary');
});
