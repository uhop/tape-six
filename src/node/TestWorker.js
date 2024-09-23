import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';

import {StopTest} from '../State.js';
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
        return;
      }
      let done = false;
      msg.events.forEach(event => {
        try {
          this.report(id, event);
        } catch (error) {
          if (error instanceof StopTest) {
            console.error('# immediate StopTest:', error.message || 'StopTest is activated');
            process.exit(1);
          }
          throw error;
        }
        if (event.type === 'end' && event.test === 0) done = true;
      });
      worker.send(done ? {done: true} : {received: true});
    });
    worker.on('exit', (code, signal) => {
      let errorMsg = '';
      if (signal) {
        errorMsg = `Worker ${id} was killed by signal: ${signal}`;
      } else if (code) {
        errorMsg = `Worker ${id} exited with error code: ${code}`;
      }
      errorMsg && this.report(id, {type: 'comment', name: 'fail to load: ' + errorMsg, test: 0});
      try {
        this.close(id);
      } catch (error) {
        if (error instanceof StopTest) {
          console.error('# immediate StopTest:', error.message || 'StopTest is activated');
          process.exit(1);
        }
        throw error;
      }
    });
    return id;
  }
}
