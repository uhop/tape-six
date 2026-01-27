const reportToParent = fileName => msg => {
  if ((msg.type === 'test' || msg.type === 'end') && !msg.test && !msg.name) {
    msg.name = 'FILE: /' + fileName;
  }
  postMessage(msg);
};

addEventListener('message', async event => {
  const msg = event.data;
  try {
    const [{setReporter}, {ProxyReporter}] = await Promise.all([
      import(new URL('test.js', msg.srcName)),
      import(new URL('./reporters/ProxyReporter.js', msg.srcName))
    ]);
    setReporter(new ProxyReporter({...msg.options, reportTo: reportToParent(msg.fileName)}));
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
