import Reporter from './Reporter.js';

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

export class JSONLReporter extends Reporter {
  constructor({failOnce = false, renumberAsserts = false, prefix, originalConsole} = {}) {
    super({failOnce});
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;
    this.console = originalConsole || console;

    prefix ||= getEnvVar('TAPE6_JSONL_PREFIX') || '';
    this.prefix = prefix ? '\n' + prefix : '';
  }
  report(event) {
    event = this.state?.preprocess(event) || event;
    if (event.type === 'assert' && this.renumberAsserts) {
      event = {...event, id: ++this.assertCounter};
    }
    switch (event.type) {
      case 'test':
        event = this.onTest(event);
        break;
      case 'end':
        this.onEnd(event);
        break;
      case 'terminated':
        this.onTerminated(event, '');
        break;
    }
    const jsonEvent = JSON.stringify(event);
    this.console.log(this.prefix ? this.prefix + jsonEvent : jsonEvent);
    this.state?.postprocess(event);
  }
}

export default JSONLReporter;
