import defer from './defer.js';

export default class EventServer {
  constructor(reporter, numberOfTasks = 1) {
    this.reporter = reporter;
    this.numberOfTasks = numberOfTasks;
    this.totalTasks = 0;
    this.fileQueue = [];
    this.passThroughId = null;
    this.backlog = {};
    this.closed = {};
  }
  report(id, event) {
    if (this.passThroughId === null) this.passThroughId = id;
    if (this.passThroughId === id) return this.reporter(event);
    const events = this.backlog[id];
    if (Array.isArray(events)) {
      events.push(event);
    } else {
      this.backlog[id] = [event];
    }
  }
  close(id) {
    this.destroyTask(id);
    --this.totalTasks;
    if (this.fileQueue.length) {
      ++this.totalTasks;
      const nextFile = this.fileQueue.shift();
      defer(() => {
        const id = this.makeTask(nextFile);
        this.report(id, {type: 'comment', name: 'file: /' + nextFile, test: 0});
      });
    }
    if (this.passThroughId === id) {
      this.passThroughId = null;
      Object.keys(this.closed).forEach(id => {
        const events = this.backlog[id];
        if (!events) return;
        events.forEach(event => this.reporter(event));
        delete this.backlog[id];
      });
      this.closed = {};
      const ids = Object.keys(this.backlog);
      if (ids.length) {
        const id = (this.passThroughId = ids[0]),
          events = this.backlog[id];
        if (events) {
          events.forEach(event => this.reporter(event));
          delete this.backlog[id];
        }
      }
    } else {
      this.closed[id] = 1;
    }
    !this.totalTasks && this.done && this.done();
  }
  createTask(fileName) {
    if (this.totalTasks < this.numberOfTasks) {
      ++this.totalTasks;
      const id = this.makeTask(fileName);
      this.report(id, {type: 'comment', name: 'file: /' + fileName, test: 0});
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
