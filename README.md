# tape-six [![NPM version][npm-img]][npm-url]

[npm-img]:      https://img.shields.io/npm/v/tape-six.svg
[npm-url]:      https://npmjs.org/package/tape-six

tape-six is a [TAP](https://en.wikipedia.org/wiki/Test_Anything_Protocol)-based library for unit tests. It is written in modern ES6 and works in [node](https://nodejs.org/), [deno](https://deno.land/) and browsers.

Why `tape-six`? It was supposed to be named `tape6` but `npm` does not allow names "similar" to existing packages. Instead of eliminating name-squatting they force to use unintuitive and unmemorable names. That's why all internal names, environment variables, and public names still use `tape6`.

Why another library? Working on projects written in modern JS (with modules) I found several problems with existing unit test libraries:

* In my opinion unit test files should be directly executable with `node`, `deno`, browsers (with a trivial HTML file to load a test file) without a need for a special test runner utility, which wraps and massages my beautiful code.
* Some of them do not work with modules.
* Some of them have the abysmal developer experience in browsers.

The documentation is TBD but you can inspect `tests/` to see how it is used.
If you are familiar with other TAP-based libraries you'll feel right at home.
