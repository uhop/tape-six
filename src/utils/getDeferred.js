class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

let getDeferred = null;

if (typeof Promise.withResolvers == 'function') {
  getDeferred = Promise.withResolvers.bind(Promise);
} else {
  getDeferred = () => new Deferred();
}

export {getDeferred};
export default getDeferred;
