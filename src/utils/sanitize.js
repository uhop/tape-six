const canDeref = {object: 1, function: 1};

const isProhibited = (value, seen) => {
  switch (typeof value) {
    case 'undefined':
    case 'bigint':
    case 'symbol':
      return true;
    case 'object':
    case 'function':
      if (value && seen.has(value)) return true;
      break;
  }
  return false;
};

export const sanitize = (value, processed, seen = new Set()) => {
  if (!processed && isProhibited(value, seen)) {
    value = null;
  }

  if (!value || canDeref[typeof value] !== 1) return value;

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(v => sanitize(v, false, seen));
  }

  // simple object
  const result = {};
  for (let [k, v] of Object.entries(value)) {
    if (isProhibited(v, seen)) continue;
    result[k] = sanitize(v, true, seen);
  }

  // was it an error? => copy non-enumerable properties
  if (value instanceof Error) {
    if (value.name && !result.name) result.name = value.name;
    if (value.message && !result.message) result.message = value.message;
    if (value.stack && !result.stack) result.stack = value.stack;
    if (value.type && !result.type) result.type = value.type;
    if (!result.type) result.type = 'Error';
  }

  return result;
};

export default sanitize;
