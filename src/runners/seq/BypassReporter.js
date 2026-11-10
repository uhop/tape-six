export class BypassReporter {
  constructor(reporter, reportTo) {
    this.reporter = reporter;
    this.reportTo = reportTo;
  }

  get failOnce() {
    return this.reporter.failOnce;
  }

  get state() {
    return this.reporter.state;
  }

  get depth() {
    return this.reporter.depth;
  }

  get timer() {
    return this.reporter.timer;
  }

  get signal() {
    return this.reporter.signal;
  }

  abort() {
    this.reporter.abort();
  }

  report(event, suppressStopTest = false) {
    this.reportTo(event, suppressStopTest);
    // EventServer reports with the throw suppressed; the test still unwinds at its next assert
    const state = this.reporter.state;
    if (suppressStopTest || !state?.stopTest) return;
    state.postprocess({...event, type: event.type || 'assert', stopTest: true});
  }
}

export default BypassReporter;
