import test from '../../index.js';

test('Signal', async t => {
  let signal = null;

  await t.test('Natural exit', t => {
    signal = t.signal;
    t.ok(signal, 'Signal is defined');
    t.notOk(signal.aborted, 'Signal is not aborted');
  });

  t.ok(signal.aborted, 'Signal (natural) is aborted');
  signal = null;

  await t.todo('Forced exit', t => {
    signal = t.signal;
    t.ok(signal, 'Signal is defined');
    t.notOk(signal.aborted, 'Signal is not aborted');
    throw new Error('Forced exit');
    t.fail('We should not reach here');
  });

  t.ok(signal.aborted, 'Signal (forced) is aborted');
  signal = null;
});
