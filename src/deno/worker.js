const sanitizeMsg = msg => {
  if (msg.type !== 'end') return msg;
  const state = {};
  for (const [key, value] of Object.entries(msg.data)) {
    if (typeof value != 'number') continue;
    state[key] = value;
  }
  return {...msg, data: state};
};

const reportToParent = fileName => msg => {
  msg = sanitizeMsg(msg);
  if ((msg.type === 'test' || msg.type === 'end') && !msg.test && !msg.name)
    msg.name = 'FILE: /' + fileName;
  postMessage(msg);
};

addEventListener('message', async event => {
  const msg = event.data;
  try {
    const {setReporter} = await import(new URL('test.js', msg.srcName));
    setReporter(reportToParent(msg.fileName));
    await import(msg.testName);
  } catch (error) {
    postMessage({type: 'test', test: 0, time: 0});
    postMessage({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
    postMessage({
      name: 'fail',
      test: 0,
      marker: new Error(),
      time: 0,
      operator: 'fail',
      fail: true,
      data: {expected: true, actual: false}
    });
    postMessage({type: 'end', test: 0, time: 0, fail: true});
  }
});
