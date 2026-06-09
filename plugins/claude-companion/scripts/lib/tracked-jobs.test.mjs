import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createProgressReporter } from "./tracked-jobs.mjs";

test("progress reporter preserves durable updates when stderr write fails", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-companion-progress-test-"));
  const logFile = path.join(dir, "job.log");
  fs.writeFileSync(logFile, "", "utf8");
  const events = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = () => {
    throw new Error("EPIPE");
  };

  try {
    const report = createProgressReporter({
      stderr: true,
      logFile,
      onEvent: (event) => events.push(event)
    });
    assert.doesNotThrow(() => report({ message: "state first", phase: "running" }));
  } finally {
    process.stderr.write = originalWrite;
  }

  assert.match(fs.readFileSync(logFile, "utf8"), /state first/);
  assert.equal(events[0].phase, "running");
});
