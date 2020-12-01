import cluster from 'cluster';
import os from 'os';

import EventServer from '../utils/EventServer.js';

export default class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks = os.cpus().length, options = {}) {
    super(reporter, numberOfTasks, options);
  }
  makeTask(fileName) {
    const worker = cluster.fork({TAPE6_WORKER: 'true'}),
      id = String(worker.id);
    worker.on('message', msg => {
      if (msg.started) {
        worker.send({id, fileName, options: this.options});
      } else {
        // console.log(id, msg);
        msg.events.forEach(event => this.report(id, event));
        worker.send({received: true});
      }
    });
    worker.on('exit', (code, signal) => {
      let error = null;
      if (signal) {
        error = Error(`Worker ${id} was killed by signal: ${signal}`);
      } else if (code) {
        error = Error(`Worker ${id} exited with error code: ${code}`);
      }
      error && this.report(id, {type: 'comment', name: 'fail to load: ' + error.message, test: 0});
      this.close(id);
    });
    return id;
  }
}
