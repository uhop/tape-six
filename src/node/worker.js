import {parentPort} from 'node:worker_threads';

const reportToParent = fileName => msg => {
  if ((msg.type === 'test' || msg.type === 'end') && !msg.test && !msg.name) {
    msg.name = 'FILE: /' + fileName;
  }
  parentPort.postMessage(msg);
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
    parentPort.postMessage({type: 'test', test: 0, time: 0});
    parentPort.postMessage({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
    parentPort.postMessage({
      name: String(error),
      test: 0,
      marker: new Error(),
      time: 0,
      operator: 'error',
      fail: true,
      data: {
        actual: error
      }
    });
    parentPort.postMessage({type: 'end', test: 0, time: 0, fail: true});
  }
});
