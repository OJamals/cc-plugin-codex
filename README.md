# Claude Code plugin for Codex

cc-plugin-codex is a plugin that lets Codex call local Claude Code CLI for cross-model coding help, code review, adversarial review, delegated rescue tasks, background job status, result retrieval, and cancellation. It mirrors OpenAI's codex-companion plugin, but for Codex.

This plugin is for Codex users who want an easy way to bring Claude Code into the workflow they already have.

## What You Get

- `$claude:review` for a normal read-only Claude review
- `$claude:adversarial-review` for a steerable challenge review
- `$claude:rescue`, `$claude:status`, `$claude:result`, and `$claude:cancel` to delegate work and manage background jobs

## Requirements

- **Codex CLI or Codex Desktop app**
- **Node.js 18.18 or later**
- **Claude Code CLI installed and authenticated**

Check Claude Code:

```bash
claude --version
claude auth status
```

## Install

Add the marketplace in Codex:

```bash
codex plugin marketplace add OJamals/cc-plugin-codex --ref main
```

Install the plugin:

```bash
codex plugin add claude@cc-plugin-codex
```

Start a new Codex thread so Codex loads the plugin.

Then run:

```text
$claude:setup
```

`$claude:setup` will tell you whether Claude Code is ready.

If Claude Code is installed but not logged in yet, run:

```bash
claude auth login
```

After install, you should see the `$claude:*` skills in Codex.

One simple first run is:

```text
$claude:adversarial-review --background
$claude:status
$claude:result
```

## Usage

### `$claude:review`

Runs a normal Claude review on your current work.

> [!NOTE]
> Code review, especially for multi-file changes, might take a while. It is generally recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your staged changes
- a review of your branch compared to a base branch like `main`

Use `--base <ref>` for branch review. Use `--scope <auto|staged|working-tree|branch>` to choose the review target. It also supports `--wait`, `--background`, `--model`, and `--effort`. It is not steerable and does not take custom focus text. Use `$claude:adversarial-review` when you want to challenge a specific decision or risk area.

Examples:

```text
$claude:review
$claude:review --base main
$claude:review --scope staged --background
```

This command is read-only and will not perform any changes. When run in the background you can use `$claude:status` to check progress and `$claude:cancel` to cancel the ongoing task.

### `$claude:adversarial-review`

Runs a **steerable** review that questions the chosen implementation and design.

It can be used to pressure-test assumptions, tradeoffs, failure modes, and whether a different approach would have been safer or simpler.

It uses the same review target selection as `$claude:review`, including `--base <ref>` for branch review and `--scope <auto|staged|working-tree|branch>` for explicit target selection. It also supports `--wait`, `--background`, `--model`, and `--effort`. Unlike `$claude:review`, it can take extra focus text after the flags.

Use it when you want:

- a review before shipping that challenges the direction, not just the code details
- review focused on design choices, tradeoffs, hidden assumptions, and alternative approaches
- pressure-testing around specific risk areas like auth, data loss, rollback, race conditions, or reliability

Examples:

```text
$claude:adversarial-review
$claude:adversarial-review --base main challenge whether this was the right caching and retry design
$claude:adversarial-review --scope staged --background look for race conditions and question the chosen approach
```

This command is read-only. It does not fix code.

### `$claude:rescue`

Hands a task to Claude Code through the local Claude CLI.

Use it when you want Claude to:

- investigate a bug
- try a fix
- continue a previous Claude task
- take a second-model pass on a coding problem

> [!NOTE]
> Depending on the task and the model you choose these tasks might take a long time, so background mode is useful for larger requests.

It supports `--background`, `--write`, `--resume`, `--resume-last`, `--fresh`, `--prompt-file`, `--model`, and `--effort`. By default, rescue runs read-only. Add `--write` when you want Claude to edit files.

Examples:

```text
$claude:rescue investigate why the tests started failing
$claude:rescue --write fix the failing test with the smallest safe patch
$claude:rescue --resume apply the top fix from the last run
$claude:rescue --model sonnet --effort high investigate the flaky integration test
$claude:rescue --background investigate the regression
```

You can also just ask for a task to be delegated to Claude:

```text
Ask Claude to redesign the database connection to be more resilient.
```

**Notes:**

- if you do not pass `--model` or `--effort`, Claude Code chooses its own defaults.
- follow-up rescue requests can continue the latest Claude task in the repo with `--resume` or `--resume-last`.
- if rescue receives no prompt, it reads piped stdin. Without a prompt or resume flag, it exits with an error.

### `$claude:status`

Shows running and recent Claude jobs for the current repository.

Examples:

```text
$claude:status
$claude:status task-abc123
$claude:status task-abc123 --wait
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `$claude:result`

Shows the final stored Claude output for a finished job. When available, it also includes the Claude session ID.

Examples:

```text
$claude:result
$claude:result task-abc123
```

### `$claude:cancel`

Cancels an active background Claude job.

Examples:

```text
$claude:cancel
$claude:cancel task-abc123
```

### `$claude:setup`

Checks whether Node, npm, Claude Code, and Claude authentication are ready.

Examples:

```text
$claude:setup
$claude:setup --json
```

## Typical Flows

### Review Before Shipping

```text
$claude:adversarial-review
```

### Hand A Problem To Claude

```text
$claude:rescue investigate why the build is failing in CI
```

### Start Something Long-Running

```text
$claude:adversarial-review --background
$claude:rescue --background investigate the flaky test
```

Then check in with:

```text
$claude:status
$claude:result
```

## Claude Integration

The cc-plugin-codex plugin uses the global `claude` binary installed in your environment. It runs Claude Code with the same local authentication and machine-local repository checkout you would use directly.

### Common Configurations

Pass a specific Claude model or effort when you want to override Claude Code defaults for a run:

```text
$claude:rescue --model sonnet --effort high investigate the flaky integration test
$claude:adversarial-review --model opus --effort max focus on rollback safety
```

Review commands are read-only. Rescue commands are read-only by default and become write-capable only when you pass `--write`.

### Moving The Work Over To Claude

Delegated rescue tasks can also be continued inside Claude Code when you have the stored Claude session ID from `$claude:result` or `$claude:status`.

This way you can review the Claude work or continue the work there.

## FAQ

### Do I need a separate Claude account for this plugin?

If you are already signed into Claude Code on the machine, that account should work immediately here too. This plugin uses your local Claude CLI authentication.

If you only use Codex today and have not used Claude Code yet, install Claude Code, sign in with `claude auth login`, and run `$claude:setup` to check whether Claude is ready.

### Does the plugin use a separate Claude runtime?

No. This plugin delegates through your local Claude Code CLI on the same machine.

That means:

- it uses the same Claude Code install you would use directly
- it uses the same local authentication state
- it uses the same repository checkout and machine-local environment

### Will it use the same Claude Code config I already have?

Yes. Because the plugin uses your local `claude` binary, your existing Claude Code setup applies.

### Can Claude edit files through this plugin?

Yes, but only for delegated rescue tasks where you pass `--write`. Reviews always run read-only.

## Direct Script Usage

The plugin skills run this script:

```bash
node plugins/claude/scripts/claude-companion.mjs <command> [options]
```

Examples:

```bash
node plugins/claude/scripts/claude-companion.mjs adversarial-review --scope staged --background
node plugins/claude/scripts/claude-companion.mjs status <job-id> --wait
node plugins/claude/scripts/claude-companion.mjs rescue --write --prompt-file task.md
```

`task` remains available as a script-level alias for `rescue` for compatibility with older local usage.

## Update

```bash
codex plugin marketplace upgrade cc-plugin-codex
codex plugin add claude@cc-plugin-codex
```

Start a new Codex thread after updating.

## Development

```bash
npm test
python3 /Users/omar/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/claude
```

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
