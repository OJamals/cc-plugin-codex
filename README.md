# Claude Companion

Claude Companion is a Codex plugin that lets Codex call the local Claude Code CLI for cross-model coding help, code review, adversarial review, delegated tasks, background job status, result retrieval, and cancellation. It is a mirror of OpenAI's codex-companion plugin, but for Codex. 

Use it when you want a second model in the loop without leaving Codex. `adversarial-review` is the recommended review mode because it is stricter than `review` and better at catching regressions, weak assumptions, risky diffs, and missed edge cases. `review` remains available as a lighter read-only baseline.

## Features

- Cross-model coding: ask Claude to inspect, investigate, or continue work without leaving Codex.
- Review scopes: review staged, working-tree, or branch diffs.
- Adversarial review: ask Claude to challenge implementation choices and focus on specific risk areas.
- Delegated tasks: send bounded investigation or implementation work to Claude, with read-only mode by default and write mode available.
- Background jobs: enqueue long-running reviews or tasks, then check status, fetch results, or cancel.
- Structured output: use `--json` for setup, review, task, status, result, and cancel commands.

## Installation

### Requirements

- Codex CLI or Desktop app
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
$claude-companion setup
$claude-companion adversarial-review --scope working-tree
$claude-companion task --background investigate why the failing test breaks
$claude-companion status
$claude-companion result
$claude-companion cancel
```

Add `$claude-companion review` or `$claude-companion adversarial-review` near the end of a development loop, before committing or opening a PR. This gives Codex a second-model review pass, with `adversarial-review` best for risky changes, regressions, and hidden edge cases.

## Commands

- `setup [--json] [--cwd <path>]`: check Node, npm, Claude Code, and Claude auth.
- `adversarial-review [focus text]`: recommended strict review mode.
- `review`: lighter read-only review mode.
- `task [prompt]`: delegate investigation or implementation work to Claude.
- `status [job-id]`: show active and recent jobs.
- `result [job-id]`: show stored output from a finished job.
- `cancel [job-id]`: cancel an active background job.

Common options:

- `--cwd <path>` or `-C <path>`: run against another working directory.
- `--json`: return machine-readable output.
- `--background`: enqueue a review or task and return a job id.
- `--wait`: keep a review in the foreground; with `status <job-id>`, wait for a queued or running job to finish.
- `--model <model>` or `-m <model>`: pass a Claude model name.
- `--effort <low|medium|high|xhigh|max>`: pass Claude effort.

Review options:

- `--scope <auto|staged|working-tree|branch>`: choose review target. `auto` reviews dirty worktrees when present, otherwise compares the current branch with the default branch.
- `--base <ref>`: compare the current branch against a specific base ref.

Task options:

- `--write`: allow Claude to edit files.
- `--resume` or `--resume-last`: continue the latest Claude session.
- `--fresh`: explicitly avoid resume mode.
- `--prompt-file <path>`: read the task prompt from a file inside the target working directory.

If `task` receives no positional prompt, it reads piped stdin. Without a prompt or resume flag, it exits with an error.

## Direct Script Usage

The plugin skill runs this script:

```bash
node plugins/claude-companion/scripts/claude-companion.mjs <command> [options]
```

Examples:

```bash
node plugins/claude-companion/scripts/claude-companion.mjs adversarial-review --scope staged --background
node plugins/claude-companion/scripts/claude-companion.mjs status <job-id> --wait
node plugins/claude-companion/scripts/claude-companion.mjs task --write --prompt-file task.md
```

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
