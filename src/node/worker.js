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
    const {setReporter} = await import(msg.utilName);
    setReporter(msg => parentPort.postMessage(sanitizeMsg(msg)));
    await import(msg.testName);
  } catch (error) {
    parentPort.postMessage({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
  }
});
