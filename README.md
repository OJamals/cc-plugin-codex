# Claude Companion

Claude Companion is the sister plugin to OpenAI's official `codex-companion` app. It lets Codex call the local Claude Code CLI for cross-model coding help, code review, adversarial review, delegated tasks, background job status, result retrieval, and cancellation.

For code review, prefer `adversarial-review`. It is stricter than `review` and more useful for catching regressions, weak assumptions, risky diffs, and missed edge cases. The `review` command remains available as a lighter read-only baseline review.

## Install

Requirements:

- Codex CLI with plugin support.
- Node.js 18.18 or newer.
- Claude Code CLI installed and authenticated.

Check Claude Code:

```bash
claude --version
claude auth status
```

Install from the published marketplace:

```bash
codex plugin marketplace add OJamals/claude-companion
codex plugin add claude-companion@claude-companion
```

Start a new Codex thread after installing so Codex loads the plugin.

Smoke test:

```text
Use Claude Companion setup.
```

## Use

Ask Codex for one of these:

```text
Use Claude Companion adversarial-review on the current working tree.
Use Claude Companion task --background to investigate why the failing test breaks.
Use Claude Companion status.
Use Claude Companion result.
Use Claude Companion cancel.
```

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
codex plugin marketplace upgrade claude-companion
codex plugin add claude-companion@claude-companion
```

Start a new Codex thread after updating.

## Development

```bash
npm test
python3 /Users/omar/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/claude-companion
```

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
