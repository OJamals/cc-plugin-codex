import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { buildSingleJobSnapshot, resolveResultJob } from "./job-control.mjs";
import { resolveJobLogFile, upsertJob, writeJobFile } from "./state.mjs";

function createIsolatedWorkspace(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "claude-companion-job-control-test-"));
  const pluginData = fs.mkdtempSync(path.join(os.tmpdir(), "claude-companion-plugin-data-test-"));
  const previousPluginData = process.env.CODEX_PLUGIN_DATA;
  process.env.CODEX_PLUGIN_DATA = pluginData;

  t.after(() => {
    if (previousPluginData === undefined) {
      delete process.env.CODEX_PLUGIN_DATA;
    } else {
      process.env.CODEX_PLUGIN_DATA = previousPluginData;
    }
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(pluginData, { recursive: true, force: true });
  });

  return cwd;
}

test("status reconciles a running job whose worker process is gone", (t) => {
  const cwd = createIsolatedWorkspace(t);
  const logFile = resolveJobLogFile(cwd, "task-stale");
  fs.writeFileSync(logFile, "[2026-06-07T00:00:00.000Z] Starting Claude.\n", "utf8");

  const job = {
    id: "task-stale",
    kind: "task",
    kindLabel: "rescue",
    title: "Claude Task",
    workspaceRoot: cwd,
    jobClass: "task",
    summary: "stale fixture",
    createdAt: "2026-06-07T00:00:00.000Z",
    startedAt: "2026-06-07T00:00:01.000Z",
    status: "running",
    phase: "running",
    pid: 123456,
    logFile
  };

  writeJobFile(cwd, job.id, job);
  upsertJob(cwd, job);

  const snapshot = buildSingleJobSnapshot(cwd, job.id, {
    isProcessAliveImpl: () => false
  });

  assert.equal(snapshot.job.status, "failed");
  assert.equal(snapshot.job.phase, "stale");
  assert.equal(snapshot.job.pid, null);
  assert.equal(snapshot.job.stale, true);
  assert.match(snapshot.job.errorMessage, /worker process 123456 is no longer running/);

  const result = resolveResultJob(cwd, job.id);
  assert.equal(result.job.status, "failed");
});

test("status normalizes legacy task labels to rescue", (t) => {
  const cwd = createIsolatedWorkspace(t);

  const job = {
    id: "task-legacy-label",
    kind: "task",
    kindLabel: "rescue",
    title: "Claude Task",
    workspaceRoot: cwd,
    jobClass: "task",
    summary: "legacy label fixture",
    createdAt: "2026-06-07T00:00:00.000Z",
    startedAt: "2026-06-07T00:00:01.000Z",
    completedAt: "2026-06-07T00:00:02.000Z",
    status: "completed",
    phase: "done",
    pid: null
  };

  writeJobFile(cwd, job.id, job);
  upsertJob(cwd, job);

  const snapshot = buildSingleJobSnapshot(cwd, job.id);

  assert.equal(snapshot.job.kindLabel, "rescue");
});
