import test from '../index.js'

test('Tester properties', t => {
  // any and _ are symbols
  const a: symbol = t.any
  const b: symbol = t._

  // signal is AbortSignal
  const s: AbortSignal = t.signal

  t.pass()
})

test('assertion signatures', t => {
  // pass / fail — verify signatures without invoking fail at runtime
  t.pass()
  t.pass('msg')
  const _fail: (msg?: string) => void = t.fail

  // ok / notOk
  t.ok(true)
  t.ok(1, 'msg')
  t.notOk(false)
  t.notOk(0, 'msg')

  // error — accepts Error | null | unknown
  t.error(null)
  t.error(undefined)
  t.error(null, 'msg')
  const _error: (error: Error | null | unknown, message?: string) => void = t.error

  // strict equality
  t.strictEqual(1, 1)
  t.strictEqual('a', 'a', 'msg')
  t.notStrictEqual(1, 2)
  t.notStrictEqual('a', 'b', 'msg')

  // loose equality
  t.looseEqual(1, '1')
  t.looseEqual(1, '1', 'msg')
  t.notLooseEqual(1, '2')
  t.notLooseEqual(1, '2', 'msg')

  // deep equality
  t.deepEqual({a: 1}, {a: 1})
  t.deepEqual([1], [1], 'msg')
  t.notDeepEqual({a: 1}, {b: 2})
  t.notDeepEqual([1], [2], 'msg')

  // deep loose equality
  t.deepLooseEqual({a: 1}, {a: '1'})
  t.deepLooseEqual({a: 1}, {a: '1'}, 'msg')
  t.notDeepLooseEqual({a: 1}, {a: 2})
  t.notDeepLooseEqual({a: 1}, {a: 2}, 'msg')

  // throws / doesNotThrow
  t.throws(() => {
    throw new Error()
  })
  t.throws(() => {
    throw new Error()
  }, 'msg')
  t.doesNotThrow(() => {})
  t.doesNotThrow(() => {}, 'msg')

  // matchString / doesNotMatchString
  t.matchString('hello', /ell/)
  t.matchString('hello', /ell/, 'msg')
  t.doesNotMatchString('hello', /xyz/)
  t.doesNotMatchString('hello', /xyz/, 'msg')

  // match / doesNotMatch (structural)
  t.match({a: 1, b: 2}, {a: 1})
  t.match({a: 1}, {a: 1}, 'msg')
  t.doesNotMatch({a: 1}, {a: 2})
  t.doesNotMatch({a: 1}, {a: 2}, 'msg')
})

test('async assertions', async t => {
  // rejects returns Promise<void>
  const r1: Promise<void> = t.rejects(Promise.reject(new Error()))
  await r1

  // resolves returns Promise<void>
  const r2: Promise<void> = t.resolves(Promise.resolve(42))
  await r2

  t.rejects(Promise.reject(new Error()), 'msg')
  t.resolves(Promise.resolve(42), 'msg')
})

test('OK / TRUE / ASSERT overloads', t => {
  // OK returns string
  const s1: string = t.OK('1 < 2')
  const s2: string = t.OK('1 < 2', 'msg')
  const s3: string = t.OK('1 < 2', 'msg', {self: 'tt'})
  const s4: string = t.OK('1 < 2', {self: 'tt'})

  // TRUE returns string
  const s5: string = t.TRUE('1 < 2')
  const s6: string = t.TRUE('1 < 2', 'msg')
  const s7: string = t.TRUE('1 < 2', 'msg', {self: 'tt'})
  const s8: string = t.TRUE('1 < 2', {self: 'tt'})

  // ASSERT returns string
  const s9: string = t.ASSERT('1 < 2')
  const s10: string = t.ASSERT('1 < 2', 'msg')
  const s11: string = t.ASSERT('1 < 2', 'msg', {self: 'tt'})
  const s12: string = t.ASSERT('1 < 2', {self: 'tt'})

  eval(s1)
})

test('assertion aliases', t => {
  // ok aliases
  t.true(true)
  t.assert(true)

  // notOk aliases
  t.false(false)
  t.notok(false)

  // error aliases
  t.ifError(null)
  t.ifErr(null)
  t.iferror(null)

  // strictEqual aliases
  t.is(1, 1)
  t.equal(1, 1)
  t.equals(1, 1)
  t.isEqual(1, 1)
  t.strictEquals(1, 1)

  // notStrictEqual aliases
  t.not(1, 2)
  t.notEqual(1, 2)
  t.notEquals(1, 2)
  t.isNotEqual(1, 2)
  t.doesNotEqual(1, 2)
  t.isUnequal(1, 2)
  t.notStrictEquals(1, 2)
  t.isNot(1, 2)

  // looseEqual aliases
  t.looseEquals(1, '1')

  // notLooseEqual aliases
  t.notLooseEquals(1, '2')

  // deepEqual aliases
  t.same([1], [1])
  t.deepEquals([1], [1])
  t.isEquivalent([1], [1])

  // notDeepEqual aliases
  t.notSame([1], [2])
  t.notDeepEquals([1], [2])
  t.notEquivalent([1], [2])
  t.notDeeply([1], [2])
  t.isNotDeepEqual([1], [2])
  t.isNotEquivalent([1], [2])

  // rejects / resolves aliases
  t.doesNotResolve(Promise.reject(new Error()))
  t.doesNotReject(Promise.resolve(42))
})

test('comment, plan, skipTest, bailOut signatures', t => {
  // comment accepts string
  t.comment('a comment')

  // plan accepts number
  t.plan(1)

  // skipTest accepts variadic args
  t.skipTest()
  t.skipTest('reason')

  // bailOut is optional string
  // (not calling bailOut as it would stop the suite)
  const _bailOut: (msg?: string) => void = t.bailOut

  t.pass()
})

test('deepEqual with any wildcard', t => {
  // t.any is usable in deep comparisons
  t.deepEqual({a: 1, b: 'hello'}, {a: t.any, b: t.any})
  t.deepEqual([1, 2, 3], [1, t._, 3])
})
