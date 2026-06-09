---
name: setup
description: Check Node, npm, Claude Code, and Claude auth readiness for cc-review-codex.
---

# cc:setup

Use when the user invokes `$cc:setup` or asks whether cc-review-codex is ready.

Run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" setup <raw arguments>
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed `cc` plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs setup <raw arguments>
```

Return stdout verbatim.

Common options:

- `--json`
- `--cwd <path>`
