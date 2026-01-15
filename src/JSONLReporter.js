const getEnv = () => {
  if (typeof Deno == 'object' && Deno?.version) {
    return Deno.env;
  } else if (typeof Bun == 'object' && Bun?.version) {
    return Bun.env;
  } else if (typeof process == 'object' && process?.versions?.node) {
    return process.env;
  }
  return {};
};

export class JSONLReporter {
  constructor({renumberAsserts = false, prefix, originalConsole} = {}) {
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;
    this.console = originalConsole || console;

    const env = getEnv();
    prefix ||= env.TAPE6_JSONL_PREFIX;
    this.prefix = prefix ? '\n' + prefix : '';
  }
  report(event) {
    if (event.type === 'assert' && this.renumberAsserts) {
      event = {...event, id: ++this.assertCounter};
    }
    const jsonEvent = JSON.stringify(event);
    this.console.log(this.prefix ? this.prefix + jsonEvent : jsonEvent);
  }
}

export default JSONLReporter;
