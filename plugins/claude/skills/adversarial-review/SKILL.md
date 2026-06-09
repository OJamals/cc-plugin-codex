---
name: adversarial-review
description: Run a steerable adversarial Claude Code review from Codex through cc-plugin-codex.
---

# claude:adversarial-review

Use when the user invokes `$claude:adversarial-review` or asks Claude to challenge implementation choices, risk areas, assumptions, or design tradeoffs.

Run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" adversarial-review <raw arguments>
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed `claude` plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs adversarial-review <raw arguments>
```

Return stdout verbatim. Do not summarize, rewrite, fix findings, or edit files.

For development workflow review, prefer this command over `$claude:review`. Fix actionable findings after the review only if the user asked Codex to continue after review output.

Common options:

- `--scope <auto|staged|working-tree|branch>`
- `--base <ref>`
- `--wait`
- `--background`
- `--model <model>`
- `--effort <low|medium|high|xhigh|max>`
- focus text after flags
