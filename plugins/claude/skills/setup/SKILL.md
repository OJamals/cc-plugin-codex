---
name: setup
description: Check Node, npm, Claude Code, and Claude auth readiness for cc-plugin-codex.
---

# claude:setup

Use when the user invokes `$claude:setup` or asks whether cc-plugin-codex is ready.

Run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" setup <raw arguments>
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed `claude` plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs setup <raw arguments>
```

Return stdout verbatim.

Common options:

- `--json`
- `--cwd <path>`
