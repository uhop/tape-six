import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const fsp = fs.promises;

const srcIndex = process.argv.indexOf('--src'),
  dstIndex = process.argv.indexOf('--dst');

if (
  srcIndex < 0 ||
  dstIndex < 0 ||
  srcIndex + 1 >= process.argv.length ||
  dstIndex + 1 >= process.argv.length
) {
  console.log('Copying files from one folder to another recursively.\n');
  console.log('Use: node copyFolder.js --src SRC_DIR --dst DST_DIR [--clear]\n');
  console.log('--src SRC_DIR --- source directory');
  console.log('--dst DST_DIR --- destination directory');
  console.log('--clear       --- if present, clear the destination');
  process.exit(1);
}

if (!/^file:\/\//.test(import.meta.url)) throw Error('Cannot get the current working directory');

const isWindows = path.sep === '\\',
  rootFolder = path.join(path.dirname(import.meta.url.substring(isWindows ? 8 : 7)), '..'),
  src = path.join(rootFolder, process.argv[srcIndex + 1]),
  dst = path.join(rootFolder, process.argv[dstIndex + 1]),
  clearFlag = process.argv.indexOf('--clear') > 0;


const clear = async folderName => {
  if (typeof fsp.rm == 'function') {
    await fsp.rm(folderName, {recursive: true});
  } else {
    await fsp.rmdir(folderName, {recursive: true});
  }
};

const ensure = async folderName => {
  // check if the directory exists
  try {
    const stat = await fsp.stat(folderName);
    if (!stat.isDirectory()) throw Error('This is not a directory: ' + folderName);
    return;
  } catch {
    // squelch
  }

  // create the directory
  try {
    await fsp.mkdir(folderName, {recursive: true});
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
};

const copyFile = async (src, dst) =>
  new Promise((resolve, reject) => {
    const pipe = fs.createReadStream(src).pipe(fs.createWriteStream(dst));
    pipe.on('error', error => reject(error));
    pipe.on('finish', () => resolve(true));
  });

const copy = async (src, dst) => {
  const stack = ['.'];
  while (stack.length) {
    const folderName = stack.pop();
    const [dirents] = await Promise.all([
      fsp.readdir(path.join(src, folderName), {withFileTypes: true}),
      ensure(path.join(dst, folderName))
    ]);
    for (const dirent of dirents) {
      if (dirent.isDirectory()) {
        stack.push(path.join(folderName, dirent.name));
        await ensure(path.join(dst, folderName, dirent.name));
        continue;
      }
      if (dirent.isFile()) {
        await copyFile(
          path.join(src, folderName, dirent.name),
          path.join(dst, folderName, dirent.name)
        );
        continue;
      }
    }
  }
};

const main = async (src, dst) => {
  const srcStat = await fsp.stat(src);
  if (!srcStat.isDirectory()) throw Error('The source is not a directory: ' + src);

  try {
    const dstStat = await fsp.stat(dst);
    if (!dstStat.isDirectory()) throw Error('The destination is not a directory: ' + dst);
    clearFlag && (await clear(dst));
  } catch {
    // squelch
  }

  await copy(src, dst);
};

main(src, dst).then(
  () => console.log('Done.'),
  error => console.error('ERROR:', error)
);
