import test from '../index.js';
import type {OutputReporter} from '../src/test.js';
import type {EventServerOptions, EventServerReporter} from '../src/utils/EventServer.js';

// EventServerReporter's contract: every tape-six reporter satisfies it —
// OutputReporter is that reporter surface, so it must be assignable
const checkReporter = (reporter: OutputReporter): EventServerReporter => reporter;

// pass-through keys read without casts in checked JS (2026-07-10: bags are `any`)
const checkPassThrough = (options: EventServerOptions): string => options.flags;

test('EventServerReporter accepts tape-six reporters (compile-time check)', t => {
  t.pass();
});
