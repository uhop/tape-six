import Reporter from './Reporter.js';

export class ProxyReporter extends Reporter {
  constructor({failOnce = false, reportTo} = {}) {
    super({failOnce});
    this.reportTo = reportTo;
  }
  report(event, suppressStopTest = false) {
    event = this.state?.preprocess(event) || event;
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
    this.reportTo(event);
    this.state?.postprocess(event, suppressStopTest);
  }
}

export default ProxyReporter;
