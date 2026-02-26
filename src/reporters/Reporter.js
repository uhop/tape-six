import State from '../State.js';
import {getTimer} from '../utils/timer.js';

export class Reporter {
  constructor({failOnce = false, timer} = {}) {
    this.failOnce = failOnce;
    this.state = null;
    this.depth = 0;
    this.timer = timer || getTimer();
  }

  get signal() {
    return this.state?.signal;
  }

  abort() {
    this.state?.abort();
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
    if (theState) {
      theState.updateParent();
      this.state = theState.parent;
      theState.dispose();
      --this.depth;
    }
    return theState;
  }

  onTerminated(event, reportingMethod = 'report') {
    while (this.state && (this.state.name || this.state.test)) {
      const theState = this.state;
      if (reportingMethod) {
        this[reportingMethod]({type: 'end', test: theState.test, name: theState.name});
      } else {
        this.onEnd();
      }
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
    'assertion-error': 'onAssertionError',
    comment: 'onComment',
    console: 'onConsole',
    stdout: 'onStdout',
    stderr: 'onStderr',
    'bail-out': 'onBailOut'
  };
}

export default Reporter;
