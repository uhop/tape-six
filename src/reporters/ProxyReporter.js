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

export class ProxyReporter extends Reporter {
  constructor({failOnce = false, reportTo} = {}) {
    super({failOnce});
    this.reportTo = reportTo;
  }
  report(event) {
    event = this.state?.preprocess(event) || event;
    switch(event.type) {
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
    this.reportTo(event);
    this.state?.postprocess(event);
  }
}

export default ProxyReporter;
