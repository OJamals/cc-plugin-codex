---
name: rescue
description: Delegate a Claude Code investigation or implementation task from Codex through cc-plugin-codex.
---

# cc:rescue

Use when the user invokes `$cc:rescue`, asks Claude to investigate, asks Claude to try a fix, or asks Claude to continue previous delegated work.

Run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" rescue <raw arguments>
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed `cc` plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs rescue <raw arguments>
```

Return stdout verbatim. Do not summarize or rewrite Claude output unless the user explicitly asks.

Task runs are read-only by default. Add `--write` only when the user wants Claude to edit files.

Common options:

- `--background`
- `--write`
- `--resume` or `--resume-last`
- `--fresh`
- `--model <model>`
- `--effort <low|medium|high|xhigh|max>`
- `--prompt-file <path>`
- prompt text after flags
