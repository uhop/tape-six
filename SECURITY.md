# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests, or discussions.**

Report privately through GitHub's **[Private Vulnerability Reporting](https://github.com/uhop/tape-six/security/advisories/new)**
(the "Report a vulnerability" button under the repository's **Security** tab). This opens a
confidential advisory visible only to the maintainers and you.

If GitHub reporting is unavailable to you, email the maintainer at
**eugene.lazutkin@gmail.com** with `SECURITY` in the subject line. Please do not disclose
details publicly until a fix is released.

When reporting, please include:

- the affected version(s) and runtime,
- the component and its options &mdash; which binary or runner, which flags and environment
  variables, which test-server route or plugin,
- a description of the issue and its impact,
- steps to reproduce: a request sent to the test server, or a test file run through a documented
  runner, with the observed result,
- any suggested remediation.

## Scope

`tape-six` is a development tool. It runs the test files you name: in the current process, in
worker threads, or in a browser page. It imports and executes those files with the full rights of
the runtime, reports their results, and sets the process exit code.

Two components listen on a socket, both on the developer's own machine:

- **The test server** (`tape6-server`, built on `createTestServer`) serves the files under its root
  folder, the web app that runs tests in a browser, and the routes its plugins add to a browser on
  the same machine. It binds to `localhost` by default. With HTTPS on, it runs `openssl` once to
  make a self-signed certificate and caches it under `node_modules/.cache/tape6/`.
- **The test helpers** `startServer` and `withServer` listen on `127.0.0.1` for the length of a
  test and hand each request to the handler the test supplies.

**The test server is not hardened. Run it on `localhost` only, never on a network other people can
reach.** It authenticates nobody and serves your project folder to whoever connects.

**Test files, configuration, and flags are trusted.** They are code and settings a developer
writes, run on a developer's machine or in CI.

One class is in scope: **a component acting beyond what you asked** &mdash; reading, writing, or
running something that your test files, configuration, and flags did not tell it to.

## Out of scope

**Code in test files.** `tape-six` imports and runs the files you name, which is its job. A test
file that reads secrets, writes files, or opens connections does so because you chose to run it.
Pointing a runner at a file you do not trust runs that file.

**Configuration and flags.** The `tape6` section of `package.json`, the `TAPE6_*` and server
environment variables, and the command-line flags come from the developer. A setting that makes a
run slow is a choice the developer made.

**Anything that needs the test server reachable from another machine.** The server is a local
development tool and is not hardened. Setting `HOST` to an interface other people can reach shares
your project folder with them, and a report that depends on such a setup is out of scope.

**Calling the API in a loop.** A proof of concept that calls assertions or helpers directly and
reports that _n_ operations take _n_ units of time describes work the caller chose to do. Deep
comparisons cost in proportion to the values compared. A report needs an attacker model: who
supplies the input, through which documented entry point, and what the attacker gains that the
caller did not already have.

**A wrong verdict.** A run that reports success while a test failed, or exits with the wrong code,
is a bug in trusted code. Report it as a regular issue.

## Scoring

The base score for this package uses **`AV:L`**. The runners, assertions, reporters, and
command-line tools take their input from the test files, configuration, and flags you supply. The
test server and the `startServer`/`withServer` helpers listen on a socket, but they are development
tools for the local machine that must not be exposed to a network (see Scope), so a vulnerability
in them is reached locally. Published advisories here are scored that way, and a report submitted
with `AV:N` is rescored rather than rejected.

## Hardening already shipped

The repository has no [published advisories](https://github.com/uhop/tape-six/security/advisories)
yet.

## Supported versions

Fixes are released against the latest published version. Please upgrade to the latest
`tape-six` release before reporting, and pin the fixed version once one is available.

## Disclosure process

- We aim to acknowledge a report within a few business days.
- We work to a coordinated-disclosure timeline (up to 90 days by default) and will keep you
  updated on progress toward a fix.
- With your permission, we credit reporters in the release notes and advisory. We are happy to
  coordinate a CVE through GitHub's CNA once a fix is validated.

Thank you for helping keep the ecosystem safe.
