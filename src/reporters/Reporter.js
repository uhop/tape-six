import State from '../State.js';
import {getTimer} from '../utils/timer.js';

export class Reporter {
  constructor({failOnce = false, timer} = {}) {
    this.failOnce = failOnce;
    this.state = null;
    this.depth = 0;
    this.timer = timer || getTimer();
  }

  onTest(event) {
    this.state = new State(this.state, {
      name: event.name,
      test: event.test,
      time: event.time,
      skip: event.skip,
      todo: event.todo,
      failOnce: this.failOnce,
      timer: this.timer
    });
    ++this.depth;
    if (typeof event.time != 'number') {
      event = {...event, time: this.state.time};
    }
    return event;
  }

  onEnd() {
    const theState = this.state;
    theState.updateParent();
    this.state = this.state.parent;
    --this.depth;
    return theState;
  }

  onTerminated(event, reportingMethod = 'report') {
    while (this.state) {
      const theState = this.state;
      this.state = this.state.parent;
      this[reportingMethod]({type: 'end', test: theState.test, name: theState.name});
      if (theState.test === event.test && theState.name === event.name) break;
    }
  }

  report(event) {
    event = this.state?.preprocess(event) || event;

    const handler = this.constructor.EVENT_MAP[event.type];
    typeof handler == 'string' && this[handler]?.(event);

    this.state?.postprocess(event);
  }

  static EVENT_MAP = {
    test: 'onTest',
    end: 'onEnd',
    terminated: 'onTerminated',
    assert: 'onAssert',
    comment: 'onComment',
    'console-log': 'onConsoleLog',
    'console-info': 'onConsoleInfo',
    'console-warn': 'onConsoleWarn',
    'console-error': 'onConsoleError',
    stdout: 'onStdout',
    stderr: 'onStderr',
    bailOut: 'onBailOut'
  };
}

export default Reporter;
