import {execFile} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

export const run = promisify(execFile);

export const root = fileURLToPath(new URL('../../../', import.meta.url)),
  PARALLEL = 'bin/tape6.js',
  SEQUENTIAL = 'bin/tape6-seq.js',
  PROC = 'bin/tape6-proc.js';

// the sequential runner shares its process with the test and cannot kill it
export const RUNNERS = [
  {label: 'parallel', bin: PARALLEL},
  {label: 'sequential', bin: SEQUENTIAL, inProcess: true},
  {label: 'proc runner', bin: PROC}
];

// Spawns the runner and reports what the operating system saw. The runner
// decides its own verdict, so nothing in-process can stand in for this: the
// 1.16.3 bug reported success through the very path that was broken, and
// tape-six's own suite runs `--flags FO`, so a green run was not proof.
// With no `bin`, the one file runs directly. `timeout` caps a run that hangs: `killed` says so.
export const runSuite = async ({
  bin,
  files,
  flags,
  par,
  env: extraEnv,
  cwd = root,
  timeout = 0
}) => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    // Deno children don't inherit the parent's permissions
    childArgs = isDeno && bin === PROC ? ['-r', '-A'] : [],
    script = bin ? [join(root, bin), ...childArgs, ...files] : files,
    args = isDeno ? ['run', '-A', ...script] : script,
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
  const result = await run(cmd, args, {cwd, env, timeout}).catch(error => error);
  return {
    code: result.code === undefined ? 0 : result.code,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    killed: result.killed === true
  };
};
