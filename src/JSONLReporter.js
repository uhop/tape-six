import {getEnv} from './utils/config.js';

export class JSONLReporter {
  constructor({renumberAsserts = false, prefix} = {}) {
    this.renumberAsserts = renumberAsserts;
    this.assertCounter = 0;

    const env = getEnv({});
    prefix ||= env.TAPE6_JSONL_PREFIX;
    this.prefix = prefix ? '\n' + prefix : '';
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
