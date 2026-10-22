// loads slower than its deadline and the grace window, so it is killed before it reports anything
await new Promise(resolve => setTimeout(resolve, 2000));

const {default: test} = await import('../../../../index.js');

test('never reached', t => {
  t.pass('loaded');
});
