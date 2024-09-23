class JSONLReporter {
  constructor({renumberAsserts = false}) {
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;
  }
  report(event) {
    if (event.type === 'assert' && this.renumberAsserts) {
      event = {...event, id: ++this.assertCounter};
    }
    console.log(JSON.stringify(event));
  }
}

export default JSONLReporter;
