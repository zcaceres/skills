# Changesets

Each PR that changes a skill should include a changeset. Run:

```
bun run changeset
```

Pick the affected skill(s), choose semver bump, write a one-line summary. The
commit will include a `.changeset/<name>.md` file. CI consumes these to bump
per-skill versions and tag releases like `<skill>@x.y.z`.
