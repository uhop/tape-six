import {getEnv} from './utils/config.js';

class JSONLReporter {
  constructor({renumberAsserts = false} = {}) {
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;

    const env = getEnv({});
    this.prefix = env.TAPE6_JSONL_PREFIX || '';
  }
  report(event) {
    if (event.type === 'assert' && this.renumberAsserts) {
      event = {...event, id: ++this.assertCounter};
    }
    if (this.prefix) {
      console.log('\n' + this.prefix + JSON.stringify(event));
    } else {
      console.log(JSON.stringify(event));
    }
  }
}

export default JSONLReporter;
