const sanitizeMsg = msg => {
  if (msg.type !== 'end') return msg;
  const state = {};
  for (const [key, value] of Object.entries(msg.data)) {
    if (typeof value != 'number') continue;
    state[key] = value;
  }
  return {...msg, data: state};
};

addEventListener('message', async event => {
  const msg = event.data;
  try {
    const {setReporter} = await import(msg.utilName);
    setReporter(msg => postMessage(sanitizeMsg(msg)));
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
