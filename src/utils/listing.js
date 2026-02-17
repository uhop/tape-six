import {promises as fsp} from 'node:fs';
import path from 'node:path';

const notSep = '[^\\' + path.sep + ']*',
  notDotSep = '[^\\.\\' + path.sep + ']*';

const sanitizeRe = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const prepRe = (string, substitute, allowDot) => {
  const parts = string.split('*'),
    startsWithStar = !parts[0],
    result = parts.map(sanitizeRe).join(substitute);
  return startsWithStar && !allowDot ? notDotSep + result : result;
};
const mergeWildcards = folders =>
  folders.reduce(
    (acc, part) => ((part || !acc.length || acc[acc.length - 1]) && acc.push(part), acc),
    []
  );

const listFiles = async function* (rootFolder, folders, baseRe, parents) {
  const dir = path.join(rootFolder, parents.join(path.sep)),
    files = await fsp.readdir(dir, {withFileTypes: true});

  if (!folders.length) {
    for (const file of files) {
      if (file.isFile() && baseRe.test(file.name)) yield path.join(dir, file.name);
    }
    return;
  }

  const theRest = folders.slice(1);

  if (folders[0]) {
    for (const file of files) {
      if (file.isDirectory() && folders[0].test(file.name))
        yield* listFiles(rootFolder, theRest, baseRe, parents.concat(file.name));
    }
    return;
  }

  yield* listFiles(rootFolder, theRest, baseRe, parents);
  for (const file of files) {
    if (file.isDirectory())
      yield* listFiles(rootFolder, folders, baseRe, parents.concat(file.name));
  }
  return;
};

export const listing = async function* (rootFolder, wildcard) {
  const parsed = path.parse(path.normalize(wildcard)),
    baseRe = new RegExp('^' + prepRe(parsed.name, '.*') + prepRe(parsed.ext, '.*', true) + '$'),
    folders = mergeWildcards(
      parsed.dir
        .split(path.sep)
        .filter(part => part)
        .map(part => (part === '**' ? null : new RegExp('^' + prepRe(part, notSep) + '$')))
    );
  yield* listFiles(rootFolder, folders, baseRe, []);
};

export const wildToRe = (rootFolder, wildcard) => {
  if (wildcard.length && wildcard[wildcard.length - 1] == path.sep) wildcard += '**';
  const parsed = path.parse(path.join(rootFolder, wildcard)),
    folders = parsed.dir
      .substring(parsed.root.length)
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
