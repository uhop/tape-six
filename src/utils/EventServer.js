import defer from './defer.js';

export default class EventServer {
  constructor(reporter, numberOfTasks = 1, options = {}) {
    this.reporter = reporter;
    this.numberOfTasks = numberOfTasks;
    this.options = options;

    this.totalTasks = 0;
    this.fileQueue = [];
    this.passThroughId = null;
    this.retained = {};
    this.readyQueue = [];
  }
  report(id, event) {
    if (this.passThroughId === null) this.passThroughId = id;
    const events = this.retained[id];
    if (this.passThroughId === id) {
      if (events) {
        for (const event of events) {
          this.reporter.report(event);
        }
        delete this.retained[id];
      }
      return this.reporter.report(event);
    }
    if (Array.isArray(events)) {
      events.push(event);
    } else {
      this.retained[id] = [event];
    }
  }
  close(id) {
    this.destroyTask(id);
    --this.totalTasks;
    if (this.fileQueue.length) {
      if (this.reporter.state?.stopTest) {
        this.fileQueue = [];
      } else {
        ++this.totalTasks;
        const nextFile = this.fileQueue.shift();
        defer(() => this.makeTask(nextFile));
      }
    }
    if (this.passThroughId === id) {
      // dump ready events
      for (const events of this.readyQueue) {
        for (const event of events) {
          this.reporter.report(event);
        }
      }
      this.readyQueue = [];
      this.passThroughId = null;
    } else {
      const events = this.retained[id];
      if (events) {
        if (this.passThroughId === null) {
          // dump events
          for (const event of events) {
            this.reporter.report(event);
          }
        } else {
          // add to the ready queue
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
      this.makeTask(fileName);
    } else {
      this.fileQueue.push(fileName);
    }
  }
  execute(files) {
    files.forEach(fileName => this.createTask(fileName));
  }
  makeTask(fileName) {
    // TBD in children
    // should return a task id as a string
  }
  destroyTask(id) {
    // TBD in children
  }
}
