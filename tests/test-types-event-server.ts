import test from '../index.js';
import type {OutputReporter} from '../src/test.js';
import type {EventServerOptions, EventServerReporter, TestEvent} from '../src/utils/EventServer.js';

// EventServerReporter's contract: every tape-six reporter satisfies it —
// OutputReporter is that reporter surface, so it must be assignable
const checkReporter = (reporter: OutputReporter): EventServerReporter => reporter;

// pass-through keys read without casts in checked JS (2026-07-10: bags are `any`)
const checkPassThrough = (options: EventServerOptions): string => options.flags;

// State-owned contract keys are declared — sisters read them in checked JS (proc: state.failed)
const checkStateFailed = (reporter: EventServerReporter): number | undefined =>
  reporter.state?.failed;

// the event protocol's spine keys are declared; the extras index stays `unknown`
const checkEventSpine = (event: TestEvent): [string, number | undefined] => [
  event.type,
  event.test
];

test('EventServerReporter accepts tape-six reporters (compile-time check)', t => {
  t.pass();
});
