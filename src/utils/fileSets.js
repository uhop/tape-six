// file sets are represented as sorted name lists with no duplicated items

export const normalize = fileSet =>
  fileSet.sort().filter((name, i, list) => !i || list[i - 1] !== name);

export const union = (a, b) => {
  if (!a.length) return b.slice(0);
  if (!b.length) return a.slice(0);

  let i = 0,
    j = 0,
    x = a[0],
    y = b[0];

  const result = [];
  for (;;) {
    if (x < y) {
      result.push(x);
      ++i;
      if (i >= a.length) break;
      x = a[i];
    } else if (x > y) {
      result.push(y);
      ++j;
      if (j >= b.length) break;
      y = b[j];
    } else {
      result.push(x);
      ++i;
      ++j;
      if (i >= a.length || j >= b.length) break;
      x = a[i];
      y = b[j];
    }
  }

  if (i < a.length) {
    result.push(...a.slice(i));
  } else if (j < b.length) {
    result.push(...b.slice(j));
  }

  return result;
};

export const intersection = (a, b) => {
  if (!a.length || !b.length) return [];

  let i = 0,
    j = 0,
    x = a[0],
    y = b[0];

  const result = [];
  for (;;) {
    if (x < y) {
      ++i;
      if (i >= a.length) break;
      x = a[i];
    } else if (x > y) {
      ++j;
      if (j >= b.length) break;
      y = b[j];
    } else {
      result.push(x);
      ++i;
      ++j;
      if (i >= a.length || j >= b.length) break;
      x = a[i];
      y = b[j];
    }
  }

  return result;
};

export const difference = (a, b) => {
  if (!a.length) return [];
  if (!b.length) return a.slice(0);

  let i = 0,
    j = 0,
    x = a[0],
    y = b[0];

  const result = [];
  for (;;) {
    if (x < y) {
      result.push(x);
      ++i;
      if (i >= a.length) break;
      x = a[i];
    } else if (x > y) {
      ++j;
      if (j >= b.length) break;
      y = b[j];
    } else {
      ++i;
      ++j;
      if (i >= a.length || j >= b.length) break;
      x = a[i];
      y = b[j];
    }
  }

  if (i < a.length) {
    result.push(...a.slice(i));
  }

  return result;
};

export const filter = (a, re) => a.filter(item => re.test(item));
export const exclude = (a, re) => a.filter(item => !re.test(item));
