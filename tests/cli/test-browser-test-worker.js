import test from '../../index.js';
import DriverTestWorker from '../../src/driver/TestWorker.js';

const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));

const waitFor = async (predicate, deadline = 2000) => {
  const stop = Date.now() + deadline;
  while (!predicate()) {
    if (Date.now() > stop) throw new Error('waitFor timed out');
    await tick();
  }
};

// a fake driver exposing exactly the API surface the base class uses
const makeFakeDriver = () => {
  const driver = {pages: [], contexts: [], closedContexts: 0, browserClosed: false};
  const makePage = context => {
    const handlers = {},
      page = {
        context,
        exposed: {},
        log: [],
        on: (event, fn) => (handlers[event] ||= []).push(fn),
        emit: (event, ...args) => (handlers[event] || []).forEach(fn => fn(...args)),
        exposeFunction: async (name, fn) => (page.exposed[name] = fn),
        goto: async url => page.log.push(['goto', url]),
        evaluate: async (fn, arg) => page.log.push(['evaluate', arg])
      };
    driver.pages.push(page);
    return page;
  };
  driver.browser = {
    newContext: () => {
      const context = {
        closed: false,
        close: async () => {
          if (context.closed) return;
          context.closed = true;
          ++driver.closedContexts;
          context.page?.emit('close');
        }
      };
      context.newPage = async () => (context.page = makePage(context));
      driver.contexts.push(context);
      return context;
    },
    close: async () => (driver.browserClosed = true)
  };
  return driver;
};

class FakeWorker extends DriverTestWorker {
  supportedBrowsers = ['fake'];
  pageErrorEvent = 'pageerror';
  constructor(reporter, numberOfTasks, options, driver) {
    super(reporter, numberOfTasks, options);
    this.driver = driver;
  }
  async launchBrowser(name, {insecure}) {
    this.driver.launched = {name, insecure};
    return this.driver.browser;
  }
  async newContext(browser, {insecure}) {
    this.driver.contextInsecure = insecure;
    return browser.newContext();
  }
}

const makeReporter = () => {
  const events = [];
  return {events, report: event => events.push(event), state: null};
};

const OPTIONS = {browser: 'fake', serverUrl: 'http://localhost:3210', flags: 'FO'};

test('a task runs to completion through the fake driver', async t => {
  const driver = makeFakeDriver(),
    reporter = makeReporter(),
    worker = new FakeWorker(reporter, 1, {...OPTIONS}, driver);

  const done = new Promise(resolve => (worker.done = resolve));
  worker.execute(['tests/test-a.js']);

  await waitFor(() => driver.pages.length && driver.pages[0].exposed.__tape6_reporter);
  const page = driver.pages[0];

  t.equal(driver.launched.name, 'fake', 'adapter launched the requested engine');
  t.notOk(driver.launched.insecure, 'http server URL is not insecure');
  t.match(page.log[0], ['goto', 'http://localhost:3210/--tests'], 'origin navigation');
  const iframeArg = page.log.find(([kind, arg]) => kind === 'evaluate' && arg?.srcdoc)?.[1];
  t.ok(iframeArg, 'the test iframe was injected');
  t.equal(iframeArg.domId, 'test-iframe-1');
  t.matchString(iframeArg.srcdoc, /window\.__tape6_id = "1";/);

  page.exposed.__tape6_reporter('1', {type: 'test', test: 0, name: 'suite'});
  page.exposed.__tape6_reporter('1', {type: 'end', test: 0});
  await done;

  t.equal(driver.closedContexts, 1, 'the task context was closed');
  t.ok(
    reporter.events.some(event => event.type === 'end'),
    'events reached the reporter'
  );

  await worker.cleanup();
  t.ok(driver.browserClosed, 'cleanup closes the browser');
});

test('an unsupported file type fails without a browser', async t => {
  const driver = makeFakeDriver(),
    reporter = makeReporter(),
    worker = new FakeWorker(reporter, 1, {...OPTIONS}, driver);

  const done = new Promise(resolve => (worker.done = resolve));
  worker.execute(['tests/test-a.txt']);
  await done;

  t.equal(driver.pages.length, 0, 'no page was opened');
  t.ok(
    reporter.events.some(event => event.fail && /unsupported file type/.test(event.name)),
    'the failure is reported'
  );
  await worker.cleanup();
});

test('a launch failure reports instead of passing silently', async t => {
  const driver = makeFakeDriver(),
    reporter = makeReporter();
  class FailingWorker extends FakeWorker {
    async launchBrowser() {
      throw new Error('engine is not installed');
    }
  }
  const worker = new FailingWorker(reporter, 1, {...OPTIONS}, driver);

  const done = new Promise(resolve => (worker.done = resolve));
  worker.execute(['tests/test-a.js']);
  await done;

  t.ok(
    reporter.events.some(event => event.fail && /engine is not installed/.test(event.name)),
    'the launch failure is a reported test failure'
  );
  await worker.cleanup();
});

test('cooperative drain escalates to a context force-kill', async t => {
  const driver = makeFakeDriver(),
    reporter = makeReporter(),
    worker = new FakeWorker(reporter, 1, {...OPTIONS, graceTimeout: 20}, driver);

  const done = new Promise(resolve => (worker.done = resolve));
  worker.execute(['tests/test-a.js']);
  await waitFor(() => driver.pages.length && driver.pages[0].exposed.__tape6_reporter);
  const page = driver.pages[0];
  page.log.length = 0;

  worker.destroyTask('1', 'failOnce');
  await waitFor(() => page.log.length > 0);
  const [kind, arg] = page.log[0];
  t.equal(kind, 'evaluate');
  t.equal(arg.domId, 'test-iframe-1', 'terminate goes to the task iframe');
  t.deepEqual(arg.message, {type: 'tape6-terminate', reason: 'failOnce'});
  t.equal(driver.closedContexts, 0, 'no kill before the grace window');

  await waitFor(() => driver.closedContexts === 1);
  t.pass('the context was force-closed after graceTimeout');
  await done;
  await worker.cleanup();
});

test('an https server URL asks the adapter for insecure contexts', async t => {
  const driver = makeFakeDriver(),
    reporter = makeReporter(),
    worker = new FakeWorker(reporter, 1, {...OPTIONS, serverUrl: 'https://localhost:3210'}, driver);

  const done = new Promise(resolve => (worker.done = resolve));
  worker.execute(['tests/test-a.js']);
  await waitFor(() => driver.pages.length && driver.pages[0].exposed.__tape6_reporter);

  t.ok(driver.launched.insecure, 'launch sees insecure');
  t.ok(driver.contextInsecure, 'context sees insecure');

  driver.pages[0].exposed.__tape6_reporter('1', {type: 'end', test: 0});
  await done;
  await worker.cleanup();
});
