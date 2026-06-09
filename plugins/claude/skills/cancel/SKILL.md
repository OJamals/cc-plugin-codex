---
name: cancel
description: Cancel an active Claude background job for cc-plugin-codex.
---

# claude:cancel

Use when the user invokes `$claude:cancel` or asks to cancel Claude background work.

Run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" cancel <raw arguments>
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed `claude` plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs cancel <raw arguments>
```

Return stdout verbatim.

Common options:

- optional job id
- `--json`
