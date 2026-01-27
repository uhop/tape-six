import test from '../../index.js';

import badImport from '../../src/utils/bad-import.js';

test('Bad import', async t => {
  t.ok(badImport);
});
