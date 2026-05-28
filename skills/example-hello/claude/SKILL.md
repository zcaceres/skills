---
name: example-hello
description: Minimal example skill demonstrating the monorepo layout. Use when the user says "say hello example".
---

# example-hello (Claude variant)

Placeholder skill showing the layout. When invoked, greet the user and explain
that this is an example.

Shared content lives in `../shared/`. Inline at build time with
`{{ include "shared/intro.md" }}`.
