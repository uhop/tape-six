import {getEnv} from './utils/config.js';

class JSONLReporter {
  constructor({renumberAsserts = false} = {}) {
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;

    const env = getEnv({});
    this.prefix = env.TAPE6_JSONL_PREFIX ? '\n' + env.TAPE6_JSONL_PREFIX : '';
  }
  report(event) {
    if (event.type === 'assert' && this.renumberAsserts) {
      event = {...event, id: ++this.assertCounter};
    }
    const jsonEvent = JSON.stringify(event);
    console.log(this.prefix ? this.prefix + jsonEvent : jsonEvent);
  }
}

export default JSONLReporter;
