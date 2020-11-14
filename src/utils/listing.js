import {promises as fsp} from 'fs';
import path from 'path';

const notSep = '[^\\' + path.sep + ']*',
  notDotSep = '[^\\.\\' + path.sep + ']*';

const sanitizeRe = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const prepRe = (string, substitute, allowDot) => {
  const parts = string.split('*'),
    startsWithStar = !parts[0],
    result = parts.map(sanitizeRe).join(substitute);
  return startsWithStar && allowDot ? result : notDotSep + result;
}
const mergeWildcards = folders => folders.reduce((acc, part) => ((part || !acc.length || acc[acc.length - 1]) && acc.push(part), acc), []);

const listFiles = async (rootFolder, folders, baseRe, parents) => {
  const dir = path.join(rootFolder, parents.join(path.sep)),
    files = await fsp.readdir(dir, {withFileTypes: true});

  let result = [];

  if (!folders.length) {
    for (const file of files) {
      if (file.isFile() && baseRe.test(file.name)) result.push(path.join(dir, file.name));
    }
    return result;
  }

  const theRest = folders.slice(1);

  if (folders[0]) {
    for (const file of files) {
      if (file.isDirectory() && folders[0].test(file.name)) {
        result = result.concat(await listFiles(rootFolder, theRest, baseRe, parents.concat(file.name)));
      }
    }
    return result;
  }

  result = result.concat(await listFiles(rootFolder, theRest, baseRe, parents));
  for (const file of files) {
    if (file.isDirectory()) {
      result = result.concat(await listFiles(rootFolder, folders, baseRe, parents.concat(file.name)));
    }
  }
  return result;
};

export const listing = async (rootFolder, wildcard) => {
  const parsed = path.parse(wildcard),
    baseRe = new RegExp('^' + prepRe(parsed.name, '.*') + prepRe(parsed.ext, '.*', true) + '$'),
    folders = mergeWildcards(
      parsed.dir
        .split(path.sep)
        .filter(part => part)
        .map(part => (part === '**' ? null : new RegExp('^' + prepRe(part, notSep) + '$')))
    );
  return listFiles(rootFolder, folders, baseRe, []);
};

export const wildToRe = (rootFolder, wildcard) => {
  const parsed = path.parse(path.join(rootFolder, wildcard)),
    folders = parsed.dir
      .substr(parsed.root.length)
      .split(path.sep)
      .filter(part => part)
      .reduce((acc, part) => {
        if (part == '**') {
          acc += '(?:|.*\\' + path.sep + ')';
        } else {
          acc += prepRe(part, notSep) + '\\' + path.sep;
        }
        return acc;
      }, parsed.root),
    name = parsed.name == '**' && !parsed.ext ? '.*' : prepRe(parsed.name, notSep);
  return new RegExp('^' + folders + name + prepRe(parsed.ext, notSep, true) + '$');
};
