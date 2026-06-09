---
name: review
description: Run a normal read-only Claude Code review from Codex through cc-review-codex.
---

# cc:review

Use when the user invokes `$cc:review` or asks for a normal Claude review.

Run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" review <raw arguments>
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed `cc` plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs review <raw arguments>
```

Return stdout verbatim. Do not summarize, rewrite, fix findings, or edit files.

Common options:

- `--scope <auto|staged|working-tree|branch>`
- `--base <ref>`
- `--wait`
- `--background`
- `--model <model>`
- `--effort <low|medium|high|xhigh|max>`
