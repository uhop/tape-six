import yamlFormatter from '../../src/yamlFormatter.js';

const format = value => {
  console.log('---');
  const lines = yamlFormatter(value);
  lines.forEach(line => console.log(line));
  console.log('...');
};

format(true);
format([1, false, null, "false", "abc", Infinity, -Infinity, NaN]);
format({a: 1, b: [], c: {}, d: [1, 2]});
format([[[{}]]]);
format([{a: [1, 2, 3], b: {c: [4, 5, 'line 1\nline 2', 'one\ttwo']}, "one\ttwo": {"line 3\nline 4": "null"}}]);
format({a: [{b: [{c: [{d: [{e: 1}]}]}]}]});
format({a: '@at', '@at': 'a', b: '`back', '`back': 'b', 'a:b': 'colon', 'colon': 'a:b'});
