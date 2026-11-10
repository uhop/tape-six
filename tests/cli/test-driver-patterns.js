import {join} from 'node:path';

import test from '../../index.js';
import {withTestServer} from '../../src/test-server.js';

import {root, run} from './helpers/run-suite.js';

const FAKE_DRIVER = join(root, 'tests/cli/fixtures/driver/fake-driver.js');

const runDriver = async (serverUrl, patterns) => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    driverArgs = [FAKE_DRIVER, '--server-url', serverUrl, ...patterns],
    args = isDeno ? ['run', '-A', ...driverArgs] : driverArgs,
    env = {...process.env};
  for (const key of Object.keys(env)) {
    if (key.startsWith('TAPE6_')) delete env[key];
  }
  Object.assign(env, {NO_COLOR: '1', TAPE6_TAP: '1'});
  const result = await run(cmd, args, {cwd: root, env}).catch(error => error);
  return {code: result.code === undefined ? 0 : result.code, stdout: result.stdout || ''};
};

// patterns that matched nothing fell back to the configured browser tests and ran them
test('the browser driver fails on patterns that match nothing', {timeout: 30000}, t =>
  withTestServer({rootFolder: root}, async base => {
    const none = await runDriver(base, ['tests/no-such-dir/test-*.html']);
    t.equal(none.code, 1, 'exits 1');
    t.matchString(none.stdout, /^No test files found on the server\.$/m, 'says so');
    t.matchString(
      none.stdout,
      /^Patterns from the command line:\r?\n {2}tests\/no-such-dir\/test-\*\.html$/m,
      'names the pattern and its source'
    );
    t.notOk(/WORKER REACHED/.test(none.stdout), 'does not run the configured tests instead');

    const configured = await runDriver(base, []);
    t.matchString(
      configured.stdout,
      /WORKER REACHED/,
      'with no patterns, runs the configured tests'
    );
  })
);
