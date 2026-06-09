import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const SCRIPT_PATH = path.resolve(fileURLToPath(new URL("../claude-companion.mjs", import.meta.url)));

function createFakeClaude(binDir) {
  const fakeClaude = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("9.9.9 (Fake Claude Code)");
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "status") {
  console.log(JSON.stringify({ loggedIn: true, authMethod: "fake-auth" }));
  process.exit(0);
}
const prompt = args[args.length - 1] || "";
console.log(JSON.stringify({
  session_id: "fake-session",
  result: "fake task ok: " + prompt,
  reasoningSummary: []
}));
`;
  const fakeClaudePath = path.join(binDir, "claude");
  fs.writeFileSync(fakeClaudePath, fakeClaude, { mode: 0o755 });
}

function createTestRepo(root) {
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "Claude Companion Test"], { cwd: repo });
  fs.writeFileSync(path.join(repo, "sample.txt"), "line one\n", "utf8");
  execFileSync("git", ["add", "sample.txt"], { cwd: repo });
  execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: repo });
  return repo;
}

function parseJson(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("rescue jobs appear as rescue in status output", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "claude-companion-cli-test-"));
  const bin = path.join(root, "bin");
  const pluginData = path.join(root, "plugin-data");
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(pluginData, { recursive: true });
  createFakeClaude(bin);
  const repo = createTestRepo(root);

  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    CODEX_PLUGIN_DATA: pluginData,
    CLAUDE_COMPANION_SESSION_ID: "cli-test-session"
  };

  const run = (args) =>
    spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
      cwd: repo,
      env,
      encoding: "utf8"
    });

  parseJson(run(["rescue", "--json", "classify this job"]));
  const status = parseJson(run(["status", "--json"]));

  assert.equal(status.latestFinished.kindLabel, "rescue");

  const waitedStatus = parseJson(run(["status", status.latestFinished.id, "--wait", "--json"]));

  assert.equal(waitedStatus.timeoutMs, 600000);
});
