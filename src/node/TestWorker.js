import cluster from 'cluster';
import os from 'os';

import EventServer from '../utils/EventServer.js';

export default class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks = os.cpus().length, options = {}) {
    super(reporter, numberOfTasks, options);
  }
  makeTask(fileName) {
    const worker = cluster.fork({TAPE6_WORKER: 'yes', TAPE6_TAP: ''}),
      id = String(worker.id);
    worker.on('message', msg => {
      if (msg.started) {
        worker.send({id, fileName, options: this.options});
      } else {
        let done = false;
        msg.events.forEach(event => {
          this.report(id, event);
          if (event.type === 'end' && event.test === 0) done = true;
        });
        worker.send(done? {done: true} : {received: true});
      }
    });
    worker.on('exit', (code, signal) => {
      let errorMsg = '';
      if (signal) {
        errorMsg = `Worker ${id} was killed by signal: ${signal}`;
      } else if (code) {
        errorMsg = `Worker ${id} exited with error code: ${code}`;
      }
      errorMsg && this.report(id, {type: 'comment', name: 'fail to load: ' + errorMsg, test: 0});
      this.close(id);
    });
    return id;
  }
}
