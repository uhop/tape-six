import State from '../State.js';
import {getTimer} from '../utils/timer.js';

// Bun's native console.log to a subprocess-piped stdout drops data / stalls under
// load (a Bun bug — see vault note tape-six-proc-bun-summary-suppressed). On Bun the
// reporters write via process.stdout.write instead; Node/Deno keep console.log.
const isBun = typeof Bun == 'object' && !!Bun?.version;

export class Reporter {
  constructor({failOnce = false, timer} = {}) {
    this.failOnce = failOnce;
    this.state = null;
    this.depth = 0;
    this.timer = timer || getTimer();
    this.terminating = false;
  }

  writeOut(...args) {
    if (isBun) {
      process.stdout.write(args.map(a => (typeof a == 'string' ? a : String(a))).join(' ') + '\n');
    } else {
      (this.console || console).log(...args);
    }
  }

  get signal() {
    return this.state?.signal;
  }

  abort() {
    this.state?.abort();
  }

  // `terminating` is remembered so a test that starts after the terminate stops
  // too — closes the race where `terminate` lands mid-startup. Cleanup
  // (finally / afterEach / afterAll) still runs. See dev-docs/worker-control-channel.md.
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
    // a terminate landed before this test started
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
