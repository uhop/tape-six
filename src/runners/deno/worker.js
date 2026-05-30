const DEFAULT_START_TIMEOUT = 5_000;

const getTimeout = () => {
  const timeoutValue = Deno.env.get('TAPE6_WORKER_START_TIMEOUT');
  if (!timeoutValue) return DEFAULT_START_TIMEOUT;
  let timeout = Number(timeoutValue);
  if (isNaN(timeout) || timeout <= 0 || timeout === Infinity) timeout = DEFAULT_START_TIMEOUT;
  return timeout;
};

const reportToParent = fileName => {
  const timeout = getTimeout();
  let timeoutBeforeStartId = setTimeout(() => {
    postMessage({type: 'test', test: 0, name: 'FILE: /' + fileName});
    postMessage({
      name: `No tests found in ${timeout}ms`,
      test: 0,
      marker: new Error(),
      operator: 'error',
      fail: true
    });
    postMessage({type: 'end', test: 0, name: 'FILE: /' + fileName, fail: true});
  }, timeout);
  return msg => {
    if (timeoutBeforeStartId) {
      clearTimeout(timeoutBeforeStartId);
      timeoutBeforeStartId = null;
    }
    if ((msg.type === 'test' || msg.type === 'end') && !msg.test && !msg.name) {
      msg.name = 'FILE: /' + fileName;
    }
    postMessage(msg);
  };
};

let currentReporter = null,
  pendingTerminate = false;

addEventListener('message', async event => {
  const msg = event.data;
  // Control plane: drain on `terminate`. The reporter arms stopTest + fires the
  // abort signal so a running test unwinds (cleanup runs); a terminate that
  // lands before the reporter exists is remembered and applied at startup.
  if (msg?.type === 'terminate') {
    pendingTerminate = true;
    currentReporter?.terminate();
    return;
  }
  try {
    const [{setReporter}, {ProxyReporter}] = await Promise.all([
      import(new URL('test.js', msg.srcName)),
      import(new URL('./reporters/ProxyReporter.js', msg.srcName))
    ]);
    currentReporter = new ProxyReporter({...msg.options, reportTo: reportToParent(msg.fileName)});
    setReporter(currentReporter);
    if (pendingTerminate) currentReporter.terminate();
    await import(msg.testName);
  } catch (error) {
    postMessage({type: 'test', test: 0});
    postMessage({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
    postMessage({
      name: String(error),
      test: 0,
      marker: new Error(),
      operator: 'error',
      fail: true,
      data: {
        actual: error
      }
    });
    postMessage({type: 'end', test: 0, fail: true});
  }
});
