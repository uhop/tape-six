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
    postMessage({type: 'comment', name: 'fail to load: ' + error.message, test: 0});
  }
});
