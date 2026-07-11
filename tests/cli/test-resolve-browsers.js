import test from '../../index.js';
import {resolveBrowsers} from '../../src/driver/cli.js';

const SUPPORTED = ['chromium', 'firefox', 'webkit'];

test('resolveBrowsers handles the fan-out forms', t => {
  t.deepEqual(resolveBrowsers('', 'chromium', SUPPORTED), {browsers: ['chromium']}, 'fallback');
  t.deepEqual(
    resolveBrowsers('firefox, webkit', 'chromium', SUPPORTED),
    {browsers: ['firefox', 'webkit']},
    'list overrides the singular'
  );
  t.deepEqual(resolveBrowsers('all', 'chromium', SUPPORTED), {browsers: SUPPORTED}, 'all');
  t.deepEqual(
    resolveBrowsers('webkit,webkit', 'chromium', SUPPORTED),
    {browsers: ['webkit']},
    'dedupe'
  );
  t.deepEqual(resolveBrowsers('opera', 'chromium', SUPPORTED), {badBrowser: 'opera'}, 'unknown');
  t.deepEqual(
    resolveBrowsers('', 'opera', SUPPORTED),
    {badBrowser: 'opera'},
    'the singular fallback is validated too'
  );
});
