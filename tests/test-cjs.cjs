const {test} = require('../index.js');

test('simple test', t => {
  t.pass();
  t.ok(1 < 2);
});
