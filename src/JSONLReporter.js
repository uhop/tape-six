const getEnvVar = name => {
  if (typeof Deno == 'object' && Deno?.version) {
    return Deno.env.get(name);
  } else if (typeof Bun == 'object' && Bun?.version) {
    return Bun.env[name];
  } else if (typeof process == 'object' && process?.versions?.node) {
    return process.env[name];
  }
  return undefined;
};

export class JSONLReporter {
  constructor({renumberAsserts = false, prefix, originalConsole} = {}) {
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;
    this.console = originalConsole || console;

    prefix ||= getEnvVar('TAPE6_JSONL_PREFIX') || '';
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
