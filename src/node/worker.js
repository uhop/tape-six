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
  try {
    const {setReporter} = await import(new URL('test.js', msg.srcName));
    setReporter(msg => parentPort.postMessage(sanitizeMsg(msg)));
    await import(msg.testName);
  } catch (error) {
    parentPort.postMessage({type: 'test', test: 0, time: 0});
    parentPort.postMessage({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
    parentPort.postMessage({
      name: 'fail',
      test: 0,
      marker: new Error(),
      time: 0,
      operator: 'fail',
      fail: true,
      data: {expected: true, actual: false}
    });
    parentPort.postMessage({type: 'end', test: 0, time: 0, fail: true});
  }
});
