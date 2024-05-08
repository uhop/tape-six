# tape-six [![NPM version][npm-img]][npm-url]

[npm-img]:      https://img.shields.io/npm/v/tape-six.svg
[npm-url]:      https://npmjs.org/package/tape-six

tape-six is a [TAP](https://en.wikipedia.org/wiki/Test_Anything_Protocol)-based library for unit tests. It is written in the modern JavaScript for the modern JavaScript and works in [node](https://nodejs.org/), [deno](https://deno.land/) and browsers.

Why `tape-six`? It was supposed to be named `tape6` but `npm` does not allow names "similar" to existing packages. Instead of eliminating name-squatting they force to use unintuitive and unmemorable names. That's why all internal names, environment variables, and public names still use `tape6`.

## Rationale

Why another library? Working on projects written in modern JS (with modules) I found several problems with existing unit test libraries:

* In my opinion unit test files should be directly executable with `node`, `deno`, browsers (with a trivial HTML file to load a test file) without a need for a special test runner utility, which wraps and massages my beautiful code.
  * Debugging my tests should be trivial. It should not be different from debugging any regular file.
* The test harness should not obfuscate code nor include hundreds of other packages.
  * I want to debug my code, not dependencies I've never heard about.
  * I want to see where a problem happens, not some guts of a test harness.
* Tests should work with ES modules natively.
  * What if I want to debug some CommonJS code with Node? Fret not! Modules can import CommonJS files directly. But not the other way around. And it helps to test how module users can use your beautiful CommonJS package.
* The [DX](https://en.wikipedia.org/wiki/User_experience#Developer_experience) in browsers are usually abysmal.
  * Both console-based debugging and a UI to navigate results should be properly supported.

## Docs

The documentation can be found in the [wiki](https://github.com/uhop/tape-six/wiki).

The documentation is mostly TBD but you can inspect `tests/` to see how it is used.
If you are familiar with other TAP-based libraries you'll feel right at home.

## Release notes

The most recent releases:

* 0.9.4 *Updated deps.*
* 0.9.3 *Made TTY reporter work with non-TTY streams.*
* 0.9.2 *Fixed Windows runner.*
* 0.9.1 *More updates related to renaming `tape6` &rArr; `tape-six`.*
* 0.9.0 *Initial release.*

For more info consult full [release notes](https://github.com/uhop/tape-six/wiki/Release-notes).
