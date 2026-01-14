import {parentPort} from 'node:worker_threads';

const sanitizeMsg = msg => {
  if (msg.type !== 'end') return msg;
  const state = {};
  for (const [key, value] of Object.entries(msg.data)) {
    if (typeof value != 'number') continue;
    state[key] = value;
  }
  return {...msg, data: state};
};

parentPort.on('message', async msg => {
  const [{JSONLReporter}, {setReporter}] = await Promise.all([
      import(new URL('JSONLReporter.js', msg.srcName)),
      import(new URL('test.js', msg.srcName))
    ]),
    reporter = new JSONLReporter();
  setReporter(msg => reporter.report(sanitizeMsg(msg)));
  try {
    await import(msg.testName);
  } catch (error) {
    reporter.report({type: 'test', test: 0, time: 0});
    reporter.report({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
    reporter.report({
      name: 'fail',
      test: 0,
      marker: new Error(),
      time: 0,
      operator: 'fail',
      fail: true,
      data: {expected: true, actual: false}
    });
    reporter.report({type: 'end', test: 0, time: 0, fail: true});
  }
});
