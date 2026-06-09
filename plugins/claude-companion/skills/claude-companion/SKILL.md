---
name: claude-companion
description: Use the local Claude Code CLI from Codex for code review, adversarial review, delegated task work, status, result retrieval, and cancellation.
---

# Claude Companion

Use this skill when the user asks Codex to ask Claude, run Claude, get a Claude review, get an adversarial review from Claude, delegate work to Claude, check Claude job status, show a Claude result, or cancel Claude work.

## Runtime

Run the companion script from this plugin:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" <command> "<raw arguments>"
```

If `CODEX_PLUGIN_ROOT` is not available, locate the installed plugin root and run:

```bash
node <plugin-root>/scripts/claude-companion.mjs <command> "<raw arguments>"
```

Return companion stdout verbatim. Do not summarize or rewrite Claude output unless the user explicitly asks.

## Commands

- Setup: `setup`
- Review: `review`
- Adversarial review: `adversarial-review`
- Delegate task: `task`
- Status: `status`
- Result: `result`
- Cancel: `cancel`

## Review Use

Use `review` for normal read-only review of current work. Use `adversarial-review` when the user wants Claude to challenge the implementation, look for blockers, or pressure-test a change.

Examples:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" review --background
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" adversarial-review --scope staged --background focus on staged session changes only
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" adversarial-review --base main --background focus on auth and data loss
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" result
```

Review commands are read-only. They should not ask Claude to edit files.
Use `--scope staged` when the worktree contains unrelated dirty files and Codex has selectively staged
only the session-specific changes for review. Use `--scope working-tree` for all dirty tracked and
untracked files, or `--scope branch`/`--base <ref>` for branch diffs.

## Task Use

Use `task` when the user asks Claude to investigate, implement, or continue work.

Examples:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" task --background investigate why CI fails
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" task --write fix the failing parser test
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" task --resume continue the previous Claude task
```

Leave model and effort unset unless the user asks for them.

## Status Flow

For long-running work:

1. Start with `--background`.
2. Check with `status`.
3. Read final output with `result`.
4. Cancel active work with `cancel` if needed.

If setup reports Claude is missing or unauthenticated, tell the user to run:

```bash
node "${CODEX_PLUGIN_ROOT}/scripts/claude-companion.mjs" setup
```
