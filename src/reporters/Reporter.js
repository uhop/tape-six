import State from '../State.js';
import {getTimer} from '../utils/timer.js';

export class Reporter {
  constructor({failOnce = false, timer} = {}) {
    this.failOnce = failOnce;
    this.state = null;
    this.depth = 0;
    this.timer = timer || getTimer();
    this.terminating = false;
  }

  get signal() {
    return this.state?.signal;
  }

  abort() {
    this.state?.abort();
  }

  // Control plane: a `terminate` command reached this worker (failOnce / bail
  // drain, or a worker deadline). Arm stopTest and fire the abort signal across
  // the live state chain so a running test unwinds — StopTest at the next
  // assertion, t.signal rejects signal-aware awaits — and remember it so any
  // test that starts afterwards stops at its first assertion too (closing the
  // race where `terminate` lands while the worker is still starting up). The
  // test's cleanup (finally / afterEach / afterAll) still runs. See
  // dev-docs/worker-control-channel.md.
  terminate() {
    this.terminating = true;
    for (let state = this.state; state; state = state.parent) {
      state.stopTest = true;
      state.abort();
    }
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
    // A terminate landed before this test started — stop it at its first
    // assertion rather than letting it run to completion.
    if (this.terminating) {
      this.state.stopTest = true;
      this.state.abort();
    }
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

  report(event, suppressStopTest = false) {
    event = this.state?.preprocess(event) || event;

    const handler = this.constructor.EVENT_MAP[event.type];
    typeof handler == 'string' && this[handler]?.(event);

    this.state?.postprocess(event, suppressStopTest);
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
