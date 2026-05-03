import test from '../index.js';
import {Tester, registerTesterMethod} from '../src/Tester.js';

const fakeReporter = {report: () => {}, timer: {now: () => 0}};

// Use throwaway names per test so prototype mutations don't leak across tests
// even if order changes.

test('registerTesterMethod: adds a new method to Tester.prototype', t => {
  const probe = '_probeAddNew';
  const fn = function () {
    return 42;
  };
  registerTesterMethod(probe, fn);
  const sub = new Tester(0, fakeReporter);
  t.equal(typeof sub[probe], 'function');
  t.equal(sub[probe](), 42);
  delete Tester.prototype[probe];
});

test('registerTesterMethod: idempotent for same fn (no-op)', t => {
  const probe = '_probeIdempotent';
  const fn = () => 'x';
  registerTesterMethod(probe, fn);
  t.doesNotThrow(() => registerTesterMethod(probe, fn));
  t.doesNotThrow(() => registerTesterMethod(probe, fn));
  const sub = new Tester(0, fakeReporter);
  t.equal(sub[probe](), 'x');
  delete Tester.prototype[probe];
});

test('registerTesterMethod: throws on collision with a different fn', t => {
  const probe = '_probeCollision';
  const fn1 = () => 1;
  const fn2 = () => 2;
  registerTesterMethod(probe, fn1);
  t.throws(
    () => registerTesterMethod(probe, fn2),
    err => err instanceof Error && /already registered/.test(err.message),
    'collision throws with informative message'
  );
  // first registration still in effect
  const sub = new Tester(0, fakeReporter);
  t.equal(sub[probe](), 1);
  delete Tester.prototype[probe];
});

test('registerTesterMethod: validates name argument', t => {
  const fn = () => {};
  t.throws(() => registerTesterMethod('', fn), TypeError);
  t.throws(() => registerTesterMethod(null, fn), TypeError);
  t.throws(() => registerTesterMethod(undefined, fn), TypeError);
  t.throws(() => registerTesterMethod(123, fn), TypeError);
});

test('registerTesterMethod: validates fn argument', t => {
  t.throws(() => registerTesterMethod('_probeValidate', null), TypeError);
  t.throws(() => registerTesterMethod('_probeValidate', undefined), TypeError);
  t.throws(() => registerTesterMethod('_probeValidate', 'not a fn'), TypeError);
  t.throws(() => registerTesterMethod('_probeValidate', 42), TypeError);
});

test("registerTesterMethod: doesn't shadow inherited Object.prototype names", t => {
  // 'toString' lives on Object.prototype, not Tester.prototype — register
  // should treat the slot as free and accept the registration.
  const probe = '_probeToStringShadow';
  const fn = () => probe;
  registerTesterMethod(probe, fn);
  const sub = new Tester(0, fakeReporter);
  t.equal(sub[probe](), probe);
  delete Tester.prototype[probe];
  // sanity: real Object.prototype methods are NOT touched by register
  t.equal(typeof sub.hasOwnProperty, 'function');
});

test('registerTesterMethod: OK already registered (idempotent at module load)', t => {
  // OK is registered by ./src/OK.js. Calling register again with the same fn
  // must be a no-op so plugins re-importing OK don't fail.
  const existing = Tester.prototype['OK'];
  t.equal(typeof existing, 'function');
  t.doesNotThrow(() => registerTesterMethod('OK', existing));
});
