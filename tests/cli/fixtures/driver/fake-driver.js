// A driver bin whose worker only says it was reached: the run stops before any browser.
import {runDriverCli} from '../../../../src/driver/cli.js';

class ReachedWorker {
  constructor() {
    console.log('WORKER REACHED');
    process.exit(3);
  }
}

runDriverCli({
  packageUrl: import.meta.url,
  commandName: 'fake-driver',
  description: 'a driver that stops at its worker',
  supportedBrowsers: ['fake'],
  TestWorker: ReachedWorker
});
