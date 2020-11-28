import cluster from 'cluster';
import os from 'os';

import EventServer from '../utils/EventServer.js';

export default class TestWorker extends EventServer {
  constructor(reporter, numberOfTasks = os.cpus().length) {
    super(reporter, numberOfTasks);
  }
  makeTask(fileName) {
    const worker = cluster.fork({TAPE6_WORKER: 'true'}),
      id = String(worker.id);
    worker.on('message', msg => this.report(id, msg.event));
    worker.on('exit', () => this.close(id));
    worker.send({fileName});
    return id;
  }
}
