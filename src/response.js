// @ts-self-types="./response.d.ts"

const isWebResponse = res =>
  typeof res?.text === 'function' && typeof res?.headers?.get === 'function';

const drainAsBuffer = res =>
  new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      try {
        resolve(Buffer.concat(chunks));
      } catch (error) {
        reject(error);
      }
    });
    res.on('error', reject);
  });

export const asText = async res => {
  if (isWebResponse(res)) return await res.text();
  const buffer = await drainAsBuffer(res);
  return buffer.toString('utf8');
};

export const asJson = async res => {
  if (isWebResponse(res)) return await res.json();
  return JSON.parse(await asText(res));
};

export const asBytes = async res => {
  if (isWebResponse(res)) {
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  }
  const buffer = await drainAsBuffer(res);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
};

export const header = (res, name) => {
  if (isWebResponse(res)) return res.headers.get(name);
  const value = res.headers?.[name.toLowerCase()];
  return value === undefined ? null : Array.isArray(value) ? value.join(', ') : value;
};

export const headers = res => {
  const out = {};
  if (isWebResponse(res)) {
    for (const [k, v] of res.headers) out[k.toLowerCase()] = v;
    return out;
  }
  if (!res.headers) return out;
  for (const [k, v] of Object.entries(res.headers)) {
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
};
