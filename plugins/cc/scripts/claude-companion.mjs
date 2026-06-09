#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseArgs, splitRawArgumentString } from "./lib/args.mjs";
import {
  DEFAULT_CONTINUE_CLAUDE_PROMPT,
  ensureClaudeAvailable,
  getClaudeAuthStatus,
  getClaudeAvailability,
  parseStructuredOutput,
  runClaudeTurn
} from "./lib/claude.mjs";
import { readStdinIfPiped, resolveFileWithinDirectory } from "./lib/fs.mjs";
import { collectReviewContext, ensureGitRepository, resolveReviewTarget } from "./lib/git.mjs";
import { binaryAvailable, terminateProcessTree } from "./lib/process.mjs";
import { loadPromptTemplate, interpolateTemplate } from "./lib/prompts.mjs";
import { generateJobId, listJobs, upsertJob, writeJobFile } from "./lib/state.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  readStoredJob,
  resolveCancelableJob,
  resolveResultJob
} from "./lib/job-control.mjs";
import {
  appendLogLine,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  nowIso,
  runTrackedJob
} from "./lib/tracked-jobs.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";
import {
  renderCancelReport,
  renderJobStatusReport,
  renderReviewResult,
  renderSetupReport,
  renderStatusReport,
  renderStoredJobResult,
  renderTaskResult
} from "./lib/render.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_STATUS_WAIT_TIMEOUT_MS = 600000;
const DEFAULT_STATUS_POLL_INTERVAL_MS = 2000;

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/claude-companion.mjs setup [--json] [--cwd <path>]",
      "  node scripts/claude-companion.mjs review [--wait|--background] [--json] [--cwd <path>] [--base <ref>] [--scope <auto|staged|working-tree|branch>] [--model <model>] [--effort <low|medium|high|xhigh|max>]",
      "  node scripts/claude-companion.mjs adversarial-review [--wait|--background] [--json] [--cwd <path>] [--base <ref>] [--scope <auto|staged|working-tree|branch>] [--model <model>] [--effort <low|medium|high|xhigh|max>] [focus text]",
      "  node scripts/claude-companion.mjs rescue [--background] [--json] [--cwd <path>] [--write] [--resume-last|--resume|--fresh] [--model <model>] [--effort <low|medium|high|xhigh|max>] [--prompt-file <path>] [prompt]",
      "  node scripts/claude-companion.mjs status [job-id] [--all] [--wait] [--json] [--cwd <path>]",
      "  node scripts/claude-companion.mjs result [job-id] [--json] [--cwd <path>]",
      "  node scripts/claude-companion.mjs cancel [job-id] [--json] [--cwd <path>]"
    ].join("\n")
  );
}

function outputResult(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    process.stdout.write(value);
  }
}

function normalizeArgv(argv) {
  if (argv.length === 1) {
    const [raw] = argv;
    return raw?.trim() ? splitRawArgumentString(raw) : [];
  }
  return argv;
}

function parseCommandInput(argv, config = {}) {
  return parseArgs(normalizeArgv(argv), {
    ...config,
    aliasMap: {
      C: "cwd",
      ...(config.aliasMap ?? {})
    }
  });
}

function resolveCommandCwd(options = {}) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shorten(text, limit = 96) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 3)}...`;
}

function firstMeaningfulLine(text, fallback) {
  return (
    String(text ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? fallback
  );
}

async function buildSetupReport(cwd) {
  const nodeStatus = binaryAvailable("node", ["--version"], { cwd });
  const npmStatus = binaryAvailable("npm", ["--version"], { cwd });
  const claudeStatus = getClaudeAvailability(cwd);
  const authStatus = await getClaudeAuthStatus(cwd);
  const nextSteps = [];
  if (!claudeStatus.available) {
    nextSteps.push("Install Claude Code.");
  }
  if (claudeStatus.available && !authStatus.loggedIn) {
    nextSteps.push("Run `claude auth login`.");
  }
  return {
    ready: nodeStatus.available && claudeStatus.available && authStatus.loggedIn,
    node: nodeStatus,
    npm: npmStatus,
    claude: claudeStatus,
    auth: authStatus,
    sessionRuntime: { label: "direct Claude CLI" },
    reviewGateEnabled: false,
    actionsTaken: [],
    nextSteps
  };
}

async function handleSetup(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });
  const cwd = resolveCommandCwd(options);
  const report = await buildSetupReport(cwd);
  outputResult(options.json ? report : renderSetupReport(report), options.json);
}

function buildAdversarialReviewPrompt(context, focusText) {
  const template = loadPromptTemplate(ROOT_DIR, "adversarial-review");
  return interpolateTemplate(template, {
    REVIEW_KIND: "Claude Adversarial Review",
    TARGET_LABEL: context.target.label,
    USER_FOCUS: focusText || "No extra focus provided.",
    REVIEW_COLLECTION_GUIDANCE: context.collectionGuidance,
    REVIEW_INPUT: context.content
  });
}

function buildReviewPrompt(context) {
  return [
    "<role>",
    "You are a senior code reviewer. Review only the target changes. Do not edit files.",
    "</role>",
    "",
    "<task>",
    `Review target: ${context.target.label}`,
    context.collectionGuidance,
    "Return JSON only with keys: verdict, summary, findings, next_steps.",
    "Each finding must include severity, title, body, file, line_start, line_end, recommendation.",
    "</task>",
    "",
    "<review_input>",
    context.content,
    "</review_input>"
  ].join("\n");
}

async function executeReviewRun(request) {
  ensureClaudeAvailable(request.cwd);
  ensureGitRepository(request.cwd);
  const target = resolveReviewTarget(request.cwd, {
    base: request.base,
    scope: request.scope
  });
  const context = collectReviewContext(request.cwd, target);
  const prompt =
    request.reviewName === "Adversarial Review"
      ? buildAdversarialReviewPrompt(context, request.focusText?.trim() ?? "")
      : buildReviewPrompt(context);
  const result = await runClaudeTurn(context.repoRoot, {
    prompt,
    model: request.model,
    effort: request.effort,
    permissionMode: "dontAsk",
    onProgress: request.onProgress
  });
  const parsed = parseStructuredOutput(result.finalMessage, {
    status: result.status,
    failureMessage: result.error?.message ?? result.stderr
  });
  const payload = {
    review: request.reviewName,
    target,
    threadId: result.threadId,
    context: {
      repoRoot: context.repoRoot,
      branch: context.branch,
      summary: context.summary
    },
    claude: {
      status: result.status,
      stderr: result.stderr,
      stdout: result.finalMessage,
      reasoning: result.reasoningSummary
    },
    result: parsed.parsed,
    rawOutput: parsed.rawOutput,
    parseError: parsed.parseError,
    reasoningSummary: result.reasoningSummary
  };

  return {
    exitStatus: result.status,
    threadId: result.threadId,
    turnId: result.turnId,
    payload,
    rendered: renderReviewResult(parsed, {
      reviewLabel: request.reviewName,
      targetLabel: context.target.label,
      reasoningSummary: result.reasoningSummary
    }),
    summary:
      parsed.parsed?.summary ??
      parsed.parseError ??
      firstMeaningfulLine(result.finalMessage, `${request.reviewName} finished.`),
    jobTitle: `Claude ${request.reviewName}`,
    jobClass: "review",
    targetLabel: context.target.label
  };
}

async function executeTaskRun(request) {
  const workspaceRoot = resolveWorkspaceRoot(request.cwd);
  ensureClaudeAvailable(request.cwd);
  if (!request.prompt && !request.resumeLast) {
    throw new Error("Provide a prompt, a prompt file, piped stdin, or use --resume-last.");
  }
  const result = await runClaudeTurn(workspaceRoot, {
    prompt: request.prompt,
    defaultPrompt: request.resumeLast ? DEFAULT_CONTINUE_CLAUDE_PROMPT : "",
    resumeLast: request.resumeLast,
    model: request.model,
    effort: request.effort,
    permissionMode: request.write ? "acceptEdits" : "dontAsk",
    onProgress: request.onProgress
  });
  const rawOutput = result.finalMessage || result.stdout || "";
  const rendered = renderTaskResult(
    {
      rawOutput,
      failureMessage: result.error?.message ?? result.stderr,
      reasoningSummary: result.reasoningSummary
    },
    {
      title: request.resumeLast ? "Claude Resume" : "Claude Task",
      jobId: request.jobId ?? null,
      write: Boolean(request.write)
    }
  );
  return {
    exitStatus: result.status,
    threadId: result.threadId,
    turnId: result.turnId,
    payload: {
      status: result.status,
      threadId: result.threadId,
      rawOutput,
      reasoningSummary: result.reasoningSummary
    },
    rendered,
    summary: firstMeaningfulLine(rawOutput, firstMeaningfulLine(result.stderr, "Claude task finished.")),
    jobTitle: request.resumeLast ? "Claude Resume" : "Claude Task",
    jobClass: "task",
    write: Boolean(request.write)
  };
}

function getJobKindLabel(kind, jobClass) {
  if (kind === "adversarial-review") {
    return "adversarial-review";
  }
  return jobClass === "review" ? "review" : "rescue";
}

function createCompanionJob({ prefix, kind, title, workspaceRoot, jobClass, summary, write = false }) {
  return createJobRecord({
    id: generateJobId(prefix),
    kind,
    kindLabel: getJobKindLabel(kind, jobClass),
    title,
    workspaceRoot,
    jobClass,
    summary,
    write
  });
}

function createTrackedProgress(job, options = {}) {
  const logFile = options.logFile ?? createJobLogFile(job.workspaceRoot, job.id, job.title);
  return {
    logFile,
    progress: createProgressReporter({
      stderr: Boolean(options.stderr),
      logFile,
      onEvent: createJobProgressUpdater(job.workspaceRoot, job.id)
    })
  };
}

async function runForegroundCommand(job, runner, options = {}) {
  const { logFile, progress } = createTrackedProgress(job, {
    logFile: options.logFile,
    stderr: !options.json
  });
  const execution = await runTrackedJob(job, () => runner(progress), { logFile });
  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
  return execution;
}

function spawnDetachedWorker(cwd, jobId, workerCommand) {
  const scriptPath = path.join(ROOT_DIR, "scripts", "claude-companion.mjs");
  const child = spawn(process.execPath, [scriptPath, workerCommand, "--cwd", cwd, "--job-id", jobId], {
    cwd,
    env: process.env,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return child;
}

function enqueueBackgroundJob(cwd, job, request, workerCommand) {
  const { logFile } = createTrackedProgress(job);
  appendLogLine(logFile, "Queued for background execution.");
  const queuedRecord = {
    ...job,
    status: "queued",
    phase: "queued",
    pid: null,
    logFile,
    request
  };
  writeJobFile(job.workspaceRoot, job.id, queuedRecord);
  upsertJob(job.workspaceRoot, queuedRecord);
  const child = spawnDetachedWorker(cwd, job.id, workerCommand);
  const current = readStoredJob(job.workspaceRoot, job.id);
  if (current?.status === "queued") {
    const queuedWithPid = {
      ...current,
      pid: child.pid ?? null
    };
    writeJobFile(job.workspaceRoot, job.id, queuedWithPid);
    upsertJob(job.workspaceRoot, {
      id: job.id,
      pid: child.pid ?? null
    });
  }
  return {
    payload: {
      jobId: job.id,
      status: "queued",
      title: job.title,
      summary: job.summary,
      logFile
    }
  };
}

function renderQueuedLaunch(payload) {
  return `${payload.title} started in the background as ${payload.jobId}. Check $cc:status ${payload.jobId} for progress.\n`;
}

async function handleReviewCommand(argv, config) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["base", "scope", "model", "effort", "cwd"],
    booleanOptions: ["json", "background", "wait"],
    aliasMap: { m: "model" },
    stopAtFirstPositional: true
  });
  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const focusText = positionals.join(" ").trim();
  const target = resolveReviewTarget(cwd, {
    base: options.base,
    scope: options.scope
  });
  const kind = config.reviewName === "Adversarial Review" ? "adversarial-review" : "review";
  const job = createCompanionJob({
    prefix: "review",
    kind,
    title: kind === "review" ? "Claude Review" : "Claude Adversarial Review",
    workspaceRoot,
    jobClass: "review",
    summary: `${config.reviewName} ${target.label}`
  });
  const request = {
    cwd,
    base: options.base,
    scope: options.scope,
    model: options.model,
    effort: options.effort,
    focusText,
    reviewName: config.reviewName
  };
  if (options.background) {
    ensureClaudeAvailable(cwd);
    const queued = enqueueBackgroundJob(cwd, job, request, "review-worker");
    outputResult(options.json ? queued.payload : renderQueuedLaunch(queued.payload), options.json);
    return;
  }
  await runForegroundCommand(
    job,
    (progress) => executeReviewRun({ ...request, onProgress: progress }),
    { json: options.json }
  );
}

async function handleReview(argv) {
  return handleReviewCommand(argv, { reviewName: "Review" });
}

async function handleAdversarialReview(argv) {
  return handleReviewCommand(argv, { reviewName: "Adversarial Review" });
}

function readTaskPrompt(cwd, options, positionals) {
  if (options["prompt-file"]) {
    return fs.readFileSync(resolveFileWithinDirectory(cwd, options["prompt-file"], "prompt file"), "utf8");
  }
  return positionals.join(" ") || readStdinIfPiped();
}

async function handleTask(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["model", "effort", "cwd", "prompt-file"],
    booleanOptions: ["json", "write", "resume-last", "resume", "fresh", "background"],
    aliasMap: { m: "model" },
    stopAtFirstPositional: true
  });
  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const prompt = readTaskPrompt(cwd, options, positionals);
  const resumeLast = Boolean(options["resume-last"] || options.resume);
  const fresh = Boolean(options.fresh);
  if (resumeLast && fresh) {
    throw new Error("Choose either --resume/--resume-last or --fresh.");
  }
  if (!prompt && !resumeLast) {
    throw new Error("Provide a prompt, a prompt file, piped stdin, or use --resume-last.");
  }
  const job = createCompanionJob({
    prefix: "task",
    kind: "task",
    title: resumeLast ? "Claude Resume" : "Claude Task",
    workspaceRoot,
    jobClass: "task",
    summary: shorten(prompt || DEFAULT_CONTINUE_CLAUDE_PROMPT),
    write: Boolean(options.write)
  });
  const request = {
    cwd,
    model: options.model,
    effort: options.effort,
    prompt,
    write: Boolean(options.write),
    resumeLast,
    jobId: job.id
  };
  if (options.background) {
    ensureClaudeAvailable(cwd);
    const queued = enqueueBackgroundJob(cwd, job, request, "task-worker");
    outputResult(options.json ? queued.payload : renderQueuedLaunch(queued.payload), options.json);
    return;
  }
  await runForegroundCommand(job, (progress) => executeTaskRun({ ...request, onProgress: progress }), {
    json: options.json
  });
}

async function handleWorker(argv, workerKind) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd", "job-id"]
  });
  if (!options["job-id"]) {
    throw new Error("Missing --job-id.");
  }
  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const stored = readStoredJob(workspaceRoot, options["job-id"]);
  if (!stored?.request) {
    throw new Error(`No queued job request found for ${options["job-id"]}.`);
  }
  const { logFile, progress } = createTrackedProgress(stored, { logFile: stored.logFile });
  await runTrackedJob(
    stored,
    () =>
      workerKind === "review"
        ? executeReviewRun({ ...stored.request, onProgress: progress })
        : executeTaskRun({ ...stored.request, onProgress: progress }),
    { logFile }
  );
}

async function waitForSingleJobSnapshot(cwd, reference, options = {}) {
  const timeoutMs = Math.max(0, Number(options.timeoutMs) || DEFAULT_STATUS_WAIT_TIMEOUT_MS);
  const pollIntervalMs = Math.max(100, Number(options.pollIntervalMs) || DEFAULT_STATUS_POLL_INTERVAL_MS);
  const deadline = Date.now() + timeoutMs;
  let snapshot = buildSingleJobSnapshot(cwd, reference);
  while ((snapshot.job.status === "queued" || snapshot.job.status === "running") && Date.now() < deadline) {
    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    snapshot = buildSingleJobSnapshot(cwd, reference);
  }
  return {
    ...snapshot,
    waitTimedOut: snapshot.job.status === "queued" || snapshot.job.status === "running",
    timeoutMs
  };
}

async function handleStatus(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json", "all", "wait"]
  });
  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? null;
  if (reference) {
    const snapshot = options.wait
      ? await waitForSingleJobSnapshot(cwd, reference)
      : buildSingleJobSnapshot(cwd, reference);
    outputResult(options.json ? snapshot : renderJobStatusReport(snapshot.job), options.json);
    return;
  }
  const report = buildStatusSnapshot(cwd, { all: options.all });
  outputResult(options.json ? report : renderStatusReport(report), options.json);
}

async function handleResult(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });
  const cwd = resolveCommandCwd(options);
  const { workspaceRoot, job } = resolveResultJob(cwd, positionals[0] ?? null);
  const stored = readStoredJob(workspaceRoot, job.id);
  const rendered = renderStoredJobResult(job, stored);
  outputResult(options.json ? { job, stored } : rendered, options.json);
}

async function handleCancel(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });
  const cwd = resolveCommandCwd(options);
  const { workspaceRoot, job } = resolveCancelableJob(cwd, positionals[0] ?? null);
  const termination = terminateProcessTree(job.pid, { cwd });
  const completedAt = nowIso();
  const terminationFailed = termination.attempted && termination.delivered && termination.confirmedExit === false;
  const patch = {
    ...job,
    status: terminationFailed ? job.status : "cancelled",
    phase: terminationFailed ? "cancel-failed" : "cancelled",
    pid: terminationFailed ? job.pid : null,
    completedAt: terminationFailed ? job.completedAt ?? null : completedAt,
    termination,
    terminationFailed
  };
  writeJobFile(workspaceRoot, job.id, patch);
  upsertJob(workspaceRoot, patch);
  outputResult(options.json ? patch : renderCancelReport(patch), options.json);
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  switch (command) {
    case "setup":
      return await handleSetup(argv);
    case "review":
      return await handleReview(argv);
    case "adversarial-review":
      return await handleAdversarialReview(argv);
    case "rescue":
    case "task":
      return await handleTask(argv);
    case "status":
      return await handleStatus(argv);
    case "result":
      return await handleResult(argv);
    case "cancel":
      return await handleCancel(argv);
    case "review-worker":
      return await handleWorker(argv, "review");
    case "task-worker":
      return await handleWorker(argv, "task");
    case "-h":
    case "--help":
    case undefined:
      printUsage();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
