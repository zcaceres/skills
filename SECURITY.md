# Security Policy

## Reporting a vulnerability

If you find a security issue in this repository — a skill that leaks secrets,
a hook that can be bypassed, an injection in a script, or anything else with a
security impact — please report it privately. Do **not** open a public issue
for an exploitable vulnerability.

Report it by opening a [GitHub private security advisory](https://github.com/zcaceres/skills/security/advisories/new).

Please include the affected skill/file, the impact, and steps to reproduce.
You'll get an acknowledgement within a few days. Once a fix is available it
will be released and the advisory published with credit (unless you prefer to
remain anonymous).

## Scope

These are AI agent skills that run locally with the permissions of whoever
invokes them. Treat every skill as code you are about to execute: read it
before running it, especially hooks and shell scripts. Reports that amount to
"a skill can do what the user told it to do" are out of scope; reports of a
skill doing something surprising, unsafe, or beyond its stated purpose are in
scope.
