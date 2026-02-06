// Faking Reporter
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

  get abort() {
    return this.reporter.abort;
  }

  report(event) {
    this.reportTo(event);
  }
}

export default BypassReporter;
