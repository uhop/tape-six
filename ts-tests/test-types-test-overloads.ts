import test from '../index.js';
import type {TestOptions, Tester} from '../index.js';

const fn = (t: Tester) => {
  t.pass();
};
const asyncFn = async (t: Tester) => {
  t.pass();
};
const opts: TestOptions = {timeout: 1000};

// test() — all 6 argument orderings
test('name-fn', fn);
test('name-fn-opts', fn, opts);
test('name-opts-fn', opts, fn);
test(fn, opts, 'fn-opts-name');
test(fn, 'fn-name', opts);
test(opts, fn, 'opts-fn-name');
test(opts, 'opts-name', fn);

// test() with async function
test('async', asyncFn);

// test() returns Promise<void>
const p: Promise<void> = test('returns promise', fn);

// test.skip() — all 6 orderings
test.skip('skip-name-fn', fn);
test.skip('skip-name-fn-opts', fn, opts);
test.skip('skip-name-opts-fn', opts, fn);
test.skip(fn, opts, 'skip-fn-opts-name');
test.skip(fn, 'skip-fn-name', opts);
test.skip(opts, fn, 'skip-opts-fn-name');
test.skip(opts, 'skip-opts-name', fn);

// test.todo() — all 6 orderings
test.todo('todo-name-fn', fn);
test.todo('todo-name-fn-opts', fn, opts);
test.todo('todo-name-opts-fn', opts, fn);
test.todo(fn, opts, 'todo-fn-opts-name');
test.todo(fn, 'todo-fn-name', opts);
test.todo(opts, fn, 'todo-opts-fn-name');
test.todo(opts, 'todo-opts-name', fn);

// test.asPromise() — callback-based
const cbFn = (t: Tester, resolve: () => void, reject: (error: unknown) => void) => {
  resolve();
};
test.asPromise('asp-name-fn', cbFn);
test.asPromise('asp-name-fn-opts', cbFn, opts);
test.asPromise('asp-name-opts-fn', opts, cbFn);
test.asPromise(cbFn, opts, 'asp-fn-opts-name');
test.asPromise(cbFn, 'asp-fn-name', opts);
test.asPromise(opts, cbFn, 'asp-opts-fn-name');
test.asPromise(opts, 'asp-opts-name', cbFn);

// t.test(), t.skip(), t.todo(), t.asPromise() — same overloads
test('tester method overloads', async t => {
  await t.test('t-name-fn', fn);
  await t.test('t-name-opts-fn', opts, fn);
  await t.test(fn, 'fn-name');
  await t.test(opts, fn, 'opts-fn-name');

  await t.skip('t-skip', fn);
  await t.skip(fn, 'skip-fn-name');

  await t.todo('t-todo', fn);
  await t.todo(fn, 'todo-fn-name');

  await t.asPromise('t-asp', cbFn);
  await t.asPromise(cbFn, 'asp-fn-name');
});
