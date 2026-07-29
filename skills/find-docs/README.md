# find-docs

Retrieve authoritative, up-to-date docs, API references, and code examples for any library or framework via the Context7 CLI. Use when answering technical questions or writing code against external tech.

## Layout

- `SKILL.md` — manifest + instructions (skills.sh standard)
- `scripts/` — executables the skill calls
- `references/` — docs the skill reads
- `assets/` — templates, samples

## Setup

### 1. Install the skill

```bash
npx skills add zcaceres/skills -s find-docs
```

### 2. Verify Context7

Context7 requires Node.js 18 or newer. You can run it on demand without
installing anything globally:

```bash
npx --yes ctx7@latest --version
```

The skill invokes the Context7 CLI directly, so you do not need to run
`ctx7 setup`. That command installs Context7's own documentation skill and may
duplicate this one.

### 3. Authenticate (optional)

Context7 works anonymously with lower rate limits. To authenticate for higher
limits, log in:

```bash
npx --yes ctx7@latest login
```

Alternatively, provide an API key through your environment:

```bash
export CONTEXT7_API_KEY="your-api-key"
```

Do not commit API keys or other credentials to your repository.

### 4. Test the integration

Run a library search to confirm Context7 is available:

```bash
npx --yes ctx7@latest library react "How does useEffect cleanup work?"
```
