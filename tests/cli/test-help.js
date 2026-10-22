import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import test from '../../index.js';

const run = promisify(execFile);

const root = fileURLToPath(new URL('../../', import.meta.url));

const help = async bin => {
  const isDeno = typeof Deno == 'object',
    cmd = isDeno ? Deno.execPath() : process.execPath,
    args = isDeno ? ['run', '-A', bin, '--help'] : [bin, '--help'];
  const {stdout} = await run(cmd, args, {cwd: root});
  return stdout;
};

const flagsIn = text => [...text.matchAll(/^\s+([A-Z])\s{2}/gm)].map(match => match[1]);

for (const bin of ['bin/tape6.js', 'bin/tape6-seq.js']) {
  test(`${bin} --help lists the web application's flags apart from the command line's`, async t => {
    const [commandLine, webApp = ''] = (await help(bin)).split(/^.*web application.*$/im);
    t.deepEqual(flagsIn(commandLine), ['F', 'T', 'B', 'D', 'O', 'N', 'M', 'C', 'H']);
    t.deepEqual(flagsIn(webApp), ['S', 'L', 'J']);
  });
}
