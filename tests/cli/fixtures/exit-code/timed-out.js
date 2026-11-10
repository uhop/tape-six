import test from '../../../../index.js';

test('runs past its timeout', {timeout: 100}, async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
});
