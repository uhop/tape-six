import defer from './defer.js';

// Fallback used when no graceTimeout is supplied through options (e.g. the
// in-browser web-app worker). CLI runners inject the env-configurable value
// (TAPE6_GRACE_TIMEOUT) via getOptions(); see src/utils/config.js.
const DEFAULT_GRACE_TIMEOUT = 5_000;

// EventServer owns two planes. The DATA plane (worker -> reporter) is the
// report()/close() event-ordering machinery. The CONTROL plane
// (reporter/runner -> worker) is a single command, `terminate`, delivered per
// transport by destroyTask(id, reason). Two triggers fire it:
//   - normal completion: close() terminates the just-finished worker ('done');
//   - stop / bail-out:   when reporter.state.stopTest is set (failOnce / bail),
//                        every in-flight worker is terminated ('failOnce').
// An optional per-worker wall-clock deadline (workerTimeout, Layer 2) fires the
// same command on expiry ('timeout'). See dev-docs/worker-control-channel.md.
export default class EventServer {
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
    this.deadlineTimers = {};
    this.stopRequested = false;
  }
  report(id, event) {
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
      if (this.reporter.state?.stopTest) this.#requestStop();
      return;
    }
    if (Array.isArray(events)) {
      events.push(event);
    } else {
      this.retained[id] = [event];
    }
  }
  close(id) {
    this.#clearDeadline(id);
    this.liveTasks.delete(id);
    this.destroyTask(id, 'done');
    --this.totalTasks;
    if (this.fileQueue.length) {
      if (this.reporter.state?.stopTest) {
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
      this.retained = {};
      this.done && this.done();
    }
  }
  createTask(fileName) {
    if (this.reporter.state?.stopTest) return;
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
  // Spawn one worker and register it for control-plane tracking. Routes both
  // the initial batch (createTask) and queue drains (close) so liveTasks and
  // the optional deadline cover every task, not just the first numberOfTasks.
  #startTask(fileName) {
    const id = this.makeTask(fileName);
    if (id == null) return id;
    this.liveTasks.add(id);
    if (this.workerTimeout > 0) {
      this.deadlineTimers[id] = setTimeout(() => {
        delete this.deadlineTimers[id];
        if (this.liveTasks.has(id)) this.destroyTask(id, 'timeout');
      }, this.workerTimeout);
    }
    return id;
  }
  #clearDeadline(id) {
    const timer = this.deadlineTimers[id];
    if (timer) {
      clearTimeout(timer);
      delete this.deadlineTimers[id];
    }
  }
  // Terminate every in-flight worker (abort) on top of the existing "stop
  // scheduling new files." Fires at most once per run; callers decide when a
  // stop / bail-out signal has been observed.
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
