import Reporter from './Reporter.js';

export class MinReporter extends Reporter {
  constructor({failOnce = false, originalConsole} = {}) {
    super({failOnce});
    this.console = originalConsole || console;
  }
  report(event) {
    event = this.state?.preprocess(event) || event;
    const handler = Reporter.EVENT_MAP[event.type];
    typeof handler == 'string' && this[handler]?.(event);
    this.console.log(
      'Test:',
      event.test,
      'Type:',
      event.type,
      'Name:',
      event.name,
      'Fail:',
      event.fail
    );
    this.state?.postprocess(event);
  }
}

export default MinReporter;
