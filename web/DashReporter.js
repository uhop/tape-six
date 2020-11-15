class DashReporter {
  constructor({renumberAsserts = false} = {}) {
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;
    this.depth = this.testCounter = this.assertCounter = this.successCounter = this.failureCounter = this.skipCounter = this.todoCounter = 0;
  }
  report(event) {
    switch (event.type) {
      case 'test':
        ++this.depth;
        break;
      case 'end':
        // summary

        // event.name && this.write('# finish: ' + event.name + ' # time=' + event.diffTime.toFixed(3) + 'ms', 'info');
        // if (this.depth) break;
        // const state = event.data,
        //   success = state.asserts - state.failed - state.skipped;
        // this.write('1..' + state.asserts, 'summary');
        // this.write('# tests ' + state.asserts, 'summary');
        // state.skipped && this.write('# skip  ' + state.skipped, 'summary-info');
        // success && this.write('# pass  ' + success, 'summary-success');
        // state.failed && this.write('# fail  ' + state.failed, 'summary-failure');
        // this.write('# ' + (event.fail ? 'not ok' : 'ok'), event.fail ? 'summary-result-failure' : 'summary-result-success');
        // this.write('# time=' + event.diffTime.toFixed(3) + 'ms', 'summary-info');
        break;
      case 'assert':
        break;
    }
  }
}

export default DashReporter;
