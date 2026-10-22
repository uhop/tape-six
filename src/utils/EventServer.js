// @ts-self-types="./EventServer.d.ts"

import defer from './defer.js';

// Fallback used when no graceTimeout is supplied through options (e.g. the
// in-browser web-app worker). CLI runners inject the env-configurable value
// (TAPE6_GRACE_TIMEOUT) via getOptions(); see src/utils/config.js.
const DEFAULT_GRACE_TIMEOUT = 5_000;

// Two planes: DATA (worker -> reporter, the report()/close() event-ordering
// machinery) and CONTROL (reporter/runner -> worker, a single `terminate`
// delivered per transport by destroyTask). See dev-docs/worker-control-channel.md.
export class EventServer {
  #owedTimeouts = new Set();
  constructor(reporter, numberOfTasks = 1, options = {}) {
    this.reporter = reporter;
    this.numberOfTasks = numberOfTasks;
    this.options = options;

    this.graceTimeout = options.graceTimeout > 0 ? options.graceTimeout : DEFAULT_GRACE_TIMEOUT;
    this.workerTimeout = options.workerTimeout > 0 ? options.workerTimeout : 0;

    this.totalTasks = 0;
    this.fileQueue = [];
    this.passThroughId = null;
    this.retained = {};
    this.readyQueue = [];

    this.liveTasks = new Set();
    this.closedTasks = new Set();
    this.deadlineTimers = {};
    this.timedOutTasks = new Set();
    this.stopRequested = false;
  }
  report(id, event) {
    if (this.timedOutTasks.has(id)) {
      // the deadline's terminate marks the worker's later events stopTest: that
      // stops this file, not the run
      if (event?.stopTest) event = {...event, stopTest: false};
      if (event?.test === 0 && (event.type === 'end' || event.type === 'terminated')) {
        this.#reportTimeout(id);
      }
    } else if (event?.type === 'end' && event.test === 0) {
      // the task closes later (a subprocess exits, a page closes): a deadline in
      // between would fail a file that has finished
      this.#clearDeadline(id);
    }
    // Stop / bail-out trigger. React the moment the signal arrives, even if
    // this worker's events are still buffered behind the pass-through worker
    // (its stopTest would otherwise not reach reporter.state until it flushes,
    // which can be many seconds later). Children pre-set event.stopTest; the
    // in-process (seq) path sets it during the forward below, caught by the
    // reporter.state check.
    if (event && (event.stopTest || event.type === 'bail-out')) this.#requestStop();
    if (this.passThroughId === null) this.passThroughId = id;
    const events = this.retained[id];
    if (this.passThroughId === id) {
      if (events) {
        for (const event of events) {
          this.reporter.report(event, true);
        }
        delete this.retained[id];
      }
      this.reporter.report(event, true);
      // in-process runners mark the shared reporter's chain on a deadline too
      if (this.reporter.state?.stopTest && !this.timedOutTasks.has(id)) this.#requestStop();
      return;
    }
    if (Array.isArray(events)) {
      events.push(event);
    } else {
      this.retained[id] = [event];
    }
  }
  close(id) {
    // a force-killed worker can still land a queued `end` — closing twice would
    // double-decrement totalTasks and end the run early
    if (this.closedTasks.has(id)) return;
    // a task can close with neither `end` nor `terminated` (a worker error)
    this.#reportTimeout(id);
    this.closedTasks.add(id);
    this.#clearDeadline(id);
    this.liveTasks.delete(id);
    this.destroyTask(id, 'done');
    --this.totalTasks;
    if (this.fileQueue.length) {
      // stopRequested, not reporter.state: a stop raised by a retained worker
      // reaches the reporter only when its lane flushes, and until then the
      // queue would keep starting files the stop was meant to cancel
      if (this.stopRequested) {
        this.fileQueue = [];
      } else {
        ++this.totalTasks;
        const nextFile = this.fileQueue.shift();
        defer(() => this.#startTask(nextFile));
      }
    }
    if (this.passThroughId === id) {
      for (const events of this.readyQueue) {
        for (const event of events) {
          this.reporter.report(event, true);
        }
      }
      this.readyQueue = [];
      this.passThroughId = null;
    } else {
      const events = this.retained[id];
      if (events) {
        if (this.passThroughId === null) {
          for (const event of events) {
            this.reporter.report(event, true);
          }
        } else {
          this.readyQueue.push(events);
        }
        delete this.retained[id];
      }
    }
    if (!this.totalTasks) {
      this.#flushPending();
      this.done && this.done();
    }
  }
  // the run is over: anything still buffered has nowhere left to go, and
  // dropping it loses the failures the exit code is computed from
  #flushPending() {
    for (const events of this.readyQueue) {
      for (const event of events) {
        this.reporter.report(event, true);
      }
    }
    this.readyQueue = [];
    for (const events of Object.values(this.retained)) {
      for (const event of events) {
        this.reporter.report(event, true);
      }
    }
    this.retained = {};
    this.passThroughId = null;
  }
  createTask(fileName) {
    if (this.stopRequested) return;
    if (this.totalTasks < this.numberOfTasks) {
      ++this.totalTasks;
      this.#startTask(fileName);
    } else {
      this.fileQueue.push(fileName);
    }
  }
  execute(files) {
    files.forEach(fileName => this.createTask(fileName));
  }
  // createTask and close() both route here so liveTasks + the deadline cover every task
  #startTask(fileName) {
    const id = this.makeTask(fileName);
    if (id == null) return id;
    // a transport may close the task inside makeTask (an unsupported file):
    // tracking it now would leave a dead id live and arm a deadline for it
    if (this.closedTasks.has(id)) return id;
    this.liveTasks.add(id);
    if (this.workerTimeout > 0) {
      this.deadlineTimers[id] = setTimeout(() => this.#onDeadline(id), this.workerTimeout);
    }
    return id;
  }
  #onDeadline(id) {
    delete this.deadlineTimers[id];
    if (!this.liveTasks.has(id)) return;
    // a task already stopping with the run owes no failure of its own
    if (!this.stopRequested) {
      this.timedOutTasks.add(id);
      this.#owedTimeouts.add(id);
    }
    this.destroyTask(id, 'timeout');
    // the deadline is the file's failure, and under failOnce a failure stops the run
    if (this.options.failOnce) this.#requestStop();
  }
  // one failure per timed-out task, however its worker stopped
  #reportTimeout(id) {
    if (!this.#owedTimeouts.delete(id)) return;
    this.report(id, {
      type: 'assert',
      name: `Terminated after ${this.workerTimeout}ms`,
      test: 0,
      marker: new Error(),
      operator: 'error',
      fail: true
    });
  }
  #clearDeadline(id) {
    const timer = this.deadlineTimers[id];
    if (timer) {
      clearTimeout(timer);
      delete this.deadlineTimers[id];
    }
  }
  #requestStop() {
    if (this.stopRequested) return;
    this.stopRequested = true;
    for (const id of this.liveTasks) {
      this.destroyTask(id, 'failOnce');
    }
  }
  makeTask(fileName) {
    // should return a task id as a string
  }
  destroyTask(id, reason) {
    // TBD in children: deliver `terminate` to one worker.
    //   reason === 'done'    -> task finished; tear the worker down now
    //   otherwise (abort)    -> drain (run cleanup), then force-kill after
    //                           graceTimeout where the transport allows
  }
}

export default EventServer;
