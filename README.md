# Claude Companion

Codex plugin that lets Codex call the local Claude Code CLI for code review, adversarial review, delegated tasks, background job status, result retrieval, and cancellation.

This repository is a standalone Codex marketplace for the `claude-companion` plugin.

## Requirements

- Codex CLI with plugin support.
- Node.js 18.18 or newer.
- Claude Code CLI installed and authenticated.

Check Claude Code locally:

```bash
claude --version
claude auth status
```

## Install From GitHub

After this repository is pushed to GitHub, add it as a Codex plugin marketplace:

```bash
codex plugin marketplace add owner/claude-companion
codex plugin add claude-companion@claude-companion
```

Replace `owner/claude-companion` with the GitHub owner and repository name.

For a local checkout:

```bash
codex plugin marketplace add /path/to/claude-companion
codex plugin add claude-companion@claude-companion
```

Start a new Codex thread after installing so Codex loads the plugin.

## Direct Script Use

From this repository:

```bash
node plugins/claude-companion/scripts/claude-companion.mjs setup
node plugins/claude-companion/scripts/claude-companion.mjs review --background
node plugins/claude-companion/scripts/claude-companion.mjs adversarial-review --background focus on auth and data loss
node plugins/claude-companion/scripts/claude-companion.mjs status
node plugins/claude-companion/scripts/claude-companion.mjs result
```

## Commands

- `setup`: checks Node, npm, Claude Code, and Claude auth.
- `review`: asks Claude for a normal read-only review.
- `adversarial-review`: asks Claude for a stricter challenge review.
- `task`: delegates investigation or implementation work to Claude.
- `status`: shows active and recent Claude Companion jobs.
- `result`: shows stored output from a finished job.
- `cancel`: cancels an active background job.

`task`, `review`, and `adversarial-review` accept `--model <model>` and `--effort <low|medium|high|xhigh|max>`. If omitted, Claude Code chooses its own defaults.

## Development

Run tests:

```bash
npm test
```

Validate plugin manifest:

```bash
python3 /Users/omar/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/claude-companion
```

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
