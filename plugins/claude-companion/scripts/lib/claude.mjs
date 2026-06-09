import { spawn } from "node:child_process";

import { binaryAvailable, runCommand } from "./process.mjs";

const DEFAULT_CONTINUE_PROMPT =
  "Continue from the current thread state. Pick the next highest-value step and follow through until the task is resolved.";

function firstMeaningfulLine(text, fallback) {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  return line ?? fallback;
}

function cleanStderr(stderr) {
  return String(stderr ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .join("\n");
}

function parseJsonObject(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractTextFromJson(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  for (const key of ["result", "finalMessage", "message", "content", "text", "response", "stdout"]) {
    if (typeof value[key] === "string" && value[key].trim()) {
      return value[key];
    }
  }
  if (Array.isArray(value.content)) {
    return value.content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractSessionId(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  for (const key of ["session_id", "sessionId", "conversation_id", "conversationId"]) {
    if (typeof value[key] === "string" && value[key].trim()) {
      return value[key].trim();
    }
  }
  return null;
}

function extractReasoningSummary(value) {
  if (!value || typeof value !== "object") {
    return [];
  }
  const raw = value.reasoningSummary ?? value.reasoning_summary ?? value.summary;
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  if (Array.isArray(raw)) {
    return raw.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim());
  }
  return [];
}

function sanitizeAuthPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const { email, orgId, orgName, ...rest } = value;
  return rest;
}

function normalizeEffort(effort) {
  if (effort == null) {
    return null;
  }
  const normalized = String(effort).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const allowed = new Set(["low", "medium", "high", "xhigh", "max"]);
  if (!allowed.has(normalized)) {
    throw new Error('Unsupported Claude effort "' + effort + '". Use one of: low, medium, high, xhigh, max.');
  }
  return normalized;
}

function buildClaudeArgs(options = {}) {
  const prompt = options.prompt || options.defaultPrompt || DEFAULT_CONTINUE_PROMPT;
  const args = ["-p", "--output-format", "json", "--permission-mode", options.permissionMode ?? "dontAsk"];
  if (options.model) {
    args.push("--model", String(options.model));
  }
  const effort = normalizeEffort(options.effort);
  if (effort) {
    args.push("--effort", effort);
  }
  if (options.resumeLast) {
    args.push("--continue");
  }
  args.push(prompt);
  return args;
}

export const DEFAULT_CONTINUE_CLAUDE_PROMPT = DEFAULT_CONTINUE_PROMPT;

export function getSessionRuntimeStatus(_env = process.env, _cwd = process.cwd()) {
  return {
    mode: "direct",
    label: "direct Claude CLI"
  };
}

export function getClaudeAvailability(cwd) {
  return binaryAvailable("claude", ["--version"], { cwd });
}

export async function getClaudeAuthStatus(cwd) {
  const result = runCommand("claude", ["auth", "status", "--json"], { cwd });
  if (result.error && result.error.code === "ENOENT") {
    return { loggedIn: false, detail: "claude not found", source: "cli" };
  }
  if (result.error) {
    return { loggedIn: false, detail: result.error.message, source: "cli" };
  }
  const parsed = parseJsonObject(result.stdout);
  if (result.status === 0) {
    const identity = parsed?.authMethod || parsed?.apiProvider || null;
    return {
      loggedIn: true,
      detail: identity ? `authenticated (${identity})` : firstMeaningfulLine(result.stderr, "authenticated"),
      source: "cli",
      raw: sanitizeAuthPayload(parsed)
    };
  }
  return {
    loggedIn: false,
    detail: cleanStderr(result.stderr) || result.stdout.trim() || `auth status exited ${result.status}`,
    source: "cli",
    raw: sanitizeAuthPayload(parsed)
  };
}

export function ensureClaudeAvailable(cwd) {
  const availability = getClaudeAvailability(cwd);
  if (!availability.available) {
    throw new Error("Claude CLI is not installed or unavailable. Install Claude Code, then rerun setup.");
  }
}

export async function runClaudeTurn(cwd, options = {}) {
  ensureClaudeAvailable(cwd);
  const args = buildClaudeArgs(options);
  options.onProgress?.({ message: "Starting Claude.", phase: "starting" });
  const spawnImpl = options.spawnImpl ?? spawn;
  const progressIntervalMs =
    options.progressIntervalMs === false
      ? 0
      : Math.max(1000, Number(options.progressIntervalMs ?? 30000));

  return await new Promise((resolve, reject) => {
    const child = spawnImpl("claude", args, {
      cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const startedAt = Date.now();
    let heartbeat = null;

    const settle = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      fn(value);
    };

    options.onProgress?.({
      message: `Claude process started${child.pid ? ` (pid ${child.pid})` : ""}.`,
      phase: "running"
    });
    if (progressIntervalMs > 0) {
      heartbeat = setInterval(() => {
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        options.onProgress?.({
          message: `Claude still running (${elapsedSeconds}s elapsed).`,
          phase: "running"
        });
      }, progressIntervalMs);
      heartbeat.unref?.();
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const line = String(chunk).split(/\r?\n/).find((entry) => entry.trim());
      if (line) {
        options.onProgress?.({ message: line.trim(), phase: "running", stderrMessage: line.trim() });
      }
    });
    child.on("error", (error) => {
      options.onProgress?.({
        message: `Claude failed to start: ${error instanceof Error ? error.message : String(error)}`,
        phase: "failed"
      });
      settle(reject, error);
    });
    child.on("exit", (code, signal) => {
      const parsed = parseJsonObject(stdout);
      const finalMessage = extractTextFromJson(parsed) || stdout.trim();
      const status = signal ? 1 : code ?? 0;
      options.onProgress?.({
        message: status === 0 ? "Claude completed." : "Claude failed.",
        phase: status === 0 ? "finalizing" : "failed"
      });
      settle(resolve, {
        status,
        signal,
        stdout,
        stderr: cleanStderr(stderr),
        finalMessage,
        threadId: extractSessionId(parsed),
        turnId: null,
        reasoningSummary: extractReasoningSummary(parsed),
        error: status === 0 ? null : new Error(cleanStderr(stderr) || finalMessage || `claude exited ${status}`)
      });
    });
  });
}

export function parseStructuredOutput(rawOutput, fallback = {}) {
  const text = String(rawOutput ?? "").trim();
  if (!text) {
    return {
      parsed: null,
      rawOutput: text,
      parseError: fallback.failureMessage || "Claude returned no output."
    };
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [text, fenced?.[1]].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return {
        parsed: JSON.parse(candidate),
        rawOutput: text,
        parseError: null
      };
    } catch {
      // Try next candidate.
    }
  }
  return {
    parsed: null,
    rawOutput: text,
    parseError: fallback.failureMessage || "Claude did not return valid JSON."
  };
}
