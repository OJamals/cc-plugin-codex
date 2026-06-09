---
name: result
description: Show stored output from a finished Claude job for cc-plugin-codex.
---

# claude:result

Use when the user invokes `$claude:result` or asks for final Claude job output.

Run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" result <raw arguments>
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed `claude` plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs result <raw arguments>
```

Return stdout verbatim.

Common options:

- optional job id
- `--json`
