import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { collectReviewContext, resolveReviewTarget } from "./git.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function writeFile(cwd, relativePath, body) {
  const absolutePath = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, body);
}

function createRepo(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "claude-companion-git-test-"));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));

  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "codex@example.test"]);
  git(repo, ["config", "user.name", "Codex Test"]);
  writeFile(repo, "README.md", "# fixture\n");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-q", "-m", "initial"]);

  return repo;
}

test("explicit working-tree scope wins even when a base ref is present", (t) => {
  const repo = createRepo(t);

  const target = resolveReviewTarget(repo, { base: "HEAD", scope: "working-tree" });

  assert.equal(target.mode, "working-tree");
  assert.equal(target.explicit, true);
});

test("staged scope resolves to a staged review target", (t) => {
  const repo = createRepo(t);
  writeFile(repo, "staged.txt", "staged change\n");
  git(repo, ["add", "staged.txt"]);

  const target = resolveReviewTarget(repo, { scope: "staged" });

  assert.equal(target.mode, "staged");
  assert.equal(target.label, "staged diff");
  assert.equal(target.explicit, true);
});

test("staged review context excludes unrelated unstaged and untracked worktree files", (t) => {
  const repo = createRepo(t);
  writeFile(repo, "staged.txt", "original staged\n");
  writeFile(repo, "unstaged.txt", "original unstaged\n");
  git(repo, ["add", "staged.txt", "unstaged.txt"]);
  git(repo, ["commit", "-q", "-m", "fixtures"]);

  writeFile(repo, "staged.txt", "staged change\n");
  git(repo, ["add", "staged.txt"]);
  writeFile(repo, "unstaged.txt", "unstaged change\n");
  writeFile(repo, "scratch/untracked.txt", "untracked scratch body\n");

  const context = collectReviewContext(repo, {
    mode: "staged",
    label: "staged diff",
    explicit: true
  });

  assert.equal(context.mode, "staged");
  assert.match(context.summary, /Reviewing 1 staged file/);
  assert.match(context.content, /staged change/);
  assert.doesNotMatch(context.content, /unstaged change/);
  assert.doesNotMatch(context.content, /untracked scratch body/);
  assert.deepEqual(context.changedFiles, ["staged.txt"]);
});

test("working-tree self-collect summary lists untracked files without inlining their bodies", (t) => {
  const repo = createRepo(t);
  writeFile(repo, "scratch/untracked.txt", "body should not be inlined in summary mode\n");

  const context = collectReviewContext(
    repo,
    { mode: "working-tree", label: "working tree diff", explicit: true },
    { maxInlineFiles: 0 }
  );

  assert.equal(context.inputMode, "self-collect");
  assert.match(context.content, /scratch\/untracked\.txt/);
  assert.doesNotMatch(context.content, /body should not be inlined/);
});
