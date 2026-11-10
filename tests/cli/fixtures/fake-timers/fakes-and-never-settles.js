import {mock} from 'node:test';

import test from '../../../../index.js';

test('fakes setTimeout, then never settles', {timeout: 200}, async t => {
  mock.timers.enable({apis: ['setTimeout']});
  t.pass('timers faked');
  await new Promise(() => {});
});

test('runs after it', t => {
  mock.timers.reset();
  t.pass('next test');
});
