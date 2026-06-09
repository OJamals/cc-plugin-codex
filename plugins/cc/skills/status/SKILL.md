---
name: status
description: Show running and recent Claude jobs for cc-plugin-codex.
---

# cc:status

Use when the user invokes `$cc:status` or asks for Claude job status.

Run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" status <raw arguments>
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed `cc` plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs status <raw arguments>
```

Return stdout verbatim.

Common options:

- optional job id
- `--all`
- `--wait`
- `--json`
