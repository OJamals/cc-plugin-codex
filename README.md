# Claude Companion

Claude Companion is the sister plugin to OpenAI's official `codex-companion` app. It lets Codex call the local Claude Code CLI for cross-model coding help, code review, adversarial review, delegated tasks, background job status, result retrieval, and cancellation.

For code review, prefer `adversarial-review`. It is stricter than `review` and more useful for catching regressions, weak assumptions, risky diffs, and missed edge cases. The `review` command remains available as a lighter read-only baseline review.

## Features

- Cross-model coding: ask Claude to inspect, investigate, or continue work without leaving Codex.
- Better code review: run normal read-only reviews against staged, working-tree, or branch diffs.
- Adversarial review: have Claude challenge implementation choices, look for regressions, and focus on specific risk areas.
- Delegated tasks: send bounded investigation or implementation work to Claude, optionally in the background.
- Job control: track status, fetch stored results, and cancel active background jobs.

## Installation

### Requirements

- Codex CLI with plugin support.
- Node.js 18.18 or newer.
- Claude Code CLI installed and authenticated.

Check Claude Code:

```bash
claude --version
claude auth status
```

### Install From Marketplace

Install from the published marketplace:

```bash
codex plugin marketplace add OJamals/claude-companion
codex plugin add claude-companion@ojamals
```

### Smoke Test

Start a new Codex thread after installing so Codex loads the plugin.

Smoke test:

```text
$claude-companion setup
```

## Use

Ask Codex for one of these:

```text
$claude-companion adversarial-review --scope working-tree
$claude-companion task --background investigate why the failing test breaks
$claude-companion status
$claude-companion result
$claude-companion cancel
```

Add `$claude-companion review` or `$claude-companion adversarial-review` near the end of a development loop, before committing or opening a PR. This gives Codex a second-model review pass, with `adversarial-review` best for risky changes, regressions, and hidden edge cases.

## Commands

- `setup`: check Node, npm, Claude Code, and Claude auth.
- `adversarial-review`: recommended code review mode.
- `review`: lighter read-only review mode.
- `task`: delegate investigation or implementation work to Claude.
- `status`: show active and recent jobs.
- `result`: show stored output from a finished job.
- `cancel`: cancel an active background job.

`task`, `review`, and `adversarial-review` accept `--model <model>` and `--effort <low|medium|high|xhigh|max>`.

## Update

```bash
codex plugin marketplace upgrade ojamals
codex plugin add claude-companion@ojamals
```

Start a new Codex thread after updating.

## Development

```bash
npm test
python3 /Users/omar/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/claude-companion
```

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
