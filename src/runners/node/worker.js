import process from 'node:process';
import {parentPort} from 'node:worker_threads';

const DEFAULT_TIMEOUT = 5_000;

const getTimeout = () => {
  const timeoutValue = process.env.TAPE6_WORKER_TIMEOUT;
  if (!timeoutValue) return DEFAULT_TIMEOUT;
  let timeout = Number(timeoutValue);
  if (isNaN(timeout) || timeout <= 0 || timeout === Infinity) timeout = DEFAULT_TIMEOUT;
  return timeout;
};

const reportToParent = fileName => {
  const timeout = getTimeout();
  let timeoutBeforeStartId = setTimeout(() => {
    parentPort.postMessage({type: 'test', test: 0, name: 'FILE: /' + fileName});
    parentPort.postMessage({
      name: `No tests found in ${timeout}ms`,
      test: 0,
      marker: new Error(),
      operator: 'error',
      fail: true
    });
    parentPort.postMessage({type: 'end', test: 0, name: 'FILE: /' + fileName, fail: true});
  }, timeout);
  return msg => {
    if (timeoutBeforeStartId) {
      clearTimeout(timeoutBeforeStartId);
      timeoutBeforeStartId = null;
    }
    if ((msg.type === 'test' || msg.type === 'end') && !msg.test && !msg.name) {
      msg.name = 'FILE: /' + fileName;
    }
    parentPort.postMessage(msg);
  };
};

parentPort.on('message', async msg => {
  try {
    const [{setReporter}, {ProxyReporter}] = await Promise.all([
      import(new URL('test.js', msg.srcName)),
      import(new URL('./reporters/ProxyReporter.js', msg.srcName))
    ]);
    setReporter(new ProxyReporter({...msg.options, reportTo: reportToParent(msg.fileName)}));
    await import(msg.testName);
  } catch (error) {
    parentPort.postMessage({type: 'test', test: 0});
    parentPort.postMessage({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
    parentPort.postMessage({
      name: String(error),
      test: 0,
      marker: new Error(),
      operator: 'error',
      fail: true,
      data: {
        actual: error
      }
    });
    parentPort.postMessage({type: 'end', test: 0, fail: true});
  }
});
