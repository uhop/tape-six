import test from '../index.js';
import type {OutputReporter} from '../src/test.js';
import type {EventServerReporter} from '../src/utils/EventServer.js';

// EventServerReporter's contract: every tape-six reporter satisfies it —
// OutputReporter is that reporter surface, so it must be assignable
const checkReporter = (reporter: OutputReporter): EventServerReporter => reporter;

test('EventServerReporter accepts tape-six reporters (compile-time check)', t => {
  t.pass();
});
