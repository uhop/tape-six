import test from '../index.js';
import yamlFormatter from '../src/utils/yamlFormatter.js';

test('yamlFormatter quotes YAML-hostile scalars', t => {
  t.deepEqual(yamlFormatter({s: 'x: y #z'}), ['s: "x: y #z"'], 'colon-space and comment');
  t.deepEqual(yamlFormatter({s: 'ends with colon:'}), ['s: "ends with colon:"'], 'trailing colon');
  t.deepEqual(yamlFormatter({s: '- leading dash'}), ['s: "- leading dash"'], 'leading indicator');
  t.deepEqual(yamlFormatter({s: '[flow'}), ['s: "[flow"'], 'leading flow indicator');
  t.deepEqual(
    yamlFormatter({s: 'file:///path/x.js:4:5'}),
    ['s: file:///path/x.js:4:5'],
    'bare colons stay plain'
  );
  t.deepEqual(yamlFormatter({s: 'plain'}), ['s: plain'], 'plain scalar untouched');
});

test('yamlFormatter quotes dates', t => {
  const [line] = yamlFormatter({d: new Date(Date.UTC(2026, 0, 2, 3, 4, 5))});
  t.matchString(line, /^d: ".* 03:04:05 GMT"$/, 'UTC string is quoted');
});

test('yamlFormatter quotes hostile keys', t => {
  t.deepEqual(yamlFormatter({'a #b': 1}), ['"a #b": 1'], 'comment intro in a key');
});
