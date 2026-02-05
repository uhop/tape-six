class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

let makeDeferred = null;

if (typeof Promise.withResolvers == 'function') {
  makeDeferred = Promise.withResolvers.bind(Promise);
} else {
  makeDeferred = () => new Deferred();
}

export {makeDeferred};
export default makeDeferred;
