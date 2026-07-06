/**
 * A promise with its `resolve` / `reject` exposed — `Promise.withResolvers()`
 * where the platform provides it, a hand-rolled equivalent otherwise.
 */
export interface Deferred<T = unknown> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export const makeDeferred: <T = unknown>() => Deferred<T>;

export default makeDeferred;
