import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { resolveFileWithinDirectory } from "./fs.mjs";

test("resolveFileWithinDirectory accepts files inside cwd", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "claude-companion-fs-test-"));
  const promptFile = path.join(cwd, "prompt.txt");
  fs.writeFileSync(promptFile, "hello\n", "utf8");

  assert.equal(resolveFileWithinDirectory(cwd, "prompt.txt", "prompt file"), fs.realpathSync(promptFile));
});

test("resolveFileWithinDirectory rejects parent paths", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "claude-companion-fs-test-"));
  const cwd = path.join(parent, "repo");
  fs.mkdirSync(cwd);
  fs.writeFileSync(path.join(parent, "outside.txt"), "secret\n", "utf8");

  assert.throws(
    () => resolveFileWithinDirectory(cwd, "../outside.txt", "prompt file"),
    /outside the working directory/
  );
});

test("resolveFileWithinDirectory rejects symlinks escaping cwd", { skip: process.platform === "win32" }, () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "claude-companion-fs-test-"));
  const cwd = path.join(parent, "repo");
  fs.mkdirSync(cwd);
  const outside = path.join(parent, "outside.txt");
  fs.writeFileSync(outside, "secret\n", "utf8");
  fs.symlinkSync(outside, path.join(cwd, "linked.txt"));

  assert.throws(
    () => resolveFileWithinDirectory(cwd, "linked.txt", "prompt file"),
    /outside the working directory/
  );
});
