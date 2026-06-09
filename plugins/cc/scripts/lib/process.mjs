import { spawnSync } from "node:child_process";
import process from "node:process";

export function runCommand(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    input: options.input,
    maxBuffer: options.maxBuffer,
    stdio: options.stdio ?? "pipe",
    shell: false,
    windowsHide: true
  });

  return {
    command,
    args,
    status: result.status ?? 0,
    signal: result.signal ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ?? null
  };
}

export function runCommandChecked(command, args = [], options = {}) {
  const result = runCommand(command, args, options);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(formatCommandFailure(result));
  }
  return result;
}

export function binaryAvailable(command, versionArgs = ["--version"], options = {}) {
  const result = runCommand(command, versionArgs, options);
  if (result.error && /** @type {NodeJS.ErrnoException} */ (result.error).code === "ENOENT") {
    return { available: false, detail: "not found" };
  }
  if (result.error) {
    return { available: false, detail: result.error.message };
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
    return { available: false, detail };
  }
  return { available: true, detail: result.stdout.trim() || result.stderr.trim() || "ok" };
}

export function isProcessAlive(pid, options = {}) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  const killImpl = options.killImpl ?? process.kill.bind(process);
  try {
    killImpl(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") {
      return false;
    }
    if (error?.code === "EPERM") {
      return true;
    }
    throw error;
  }
}

function looksLikeMissingProcessMessage(text) {
  return /not found|no running instance|cannot find|does not exist|no such process/i.test(text);
}

export function terminateProcessTree(pid, options = {}) {
  if (!Number.isFinite(pid)) {
    return { attempted: false, delivered: false, method: null };
  }

  const platform = options.platform ?? process.platform;
  const runCommandImpl = options.runCommandImpl ?? runCommand;
  const killImpl = options.killImpl ?? process.kill.bind(process);
  const waitMs = Math.max(0, Number(options.waitMs ?? 5000));
  const pollMs = Math.max(10, Number(options.pollMs ?? 100));

  function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  }

  function signal(targetPid, signalName) {
    try {
      killImpl(targetPid, signalName);
      return true;
    } catch (error) {
      if (error?.code === "ESRCH") {
        return false;
      }
      throw error;
    }
  }

  function isAlive(targetPid) {
    try {
      killImpl(targetPid, 0);
      return true;
    } catch (error) {
      if (error?.code === "ESRCH") {
        return false;
      }
      throw error;
    }
  }

  function waitUntilGone(targetPid) {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      if (!isAlive(targetPid)) {
        return true;
      }
      sleepSync(Math.min(pollMs, Math.max(0, deadline - Date.now())));
    }
    return !isAlive(targetPid);
  }

  if (platform === "win32") {
    const result = runCommandImpl("taskkill", ["/PID", String(pid), "/T", "/F"], {
      cwd: options.cwd,
      env: options.env
    });

    if (!result.error && result.status === 0) {
      return { attempted: true, delivered: true, confirmedExit: true, method: "taskkill", result };
    }

    const combinedOutput = `${result.stderr}\n${result.stdout}`.trim();
    if (!result.error && looksLikeMissingProcessMessage(combinedOutput)) {
      return { attempted: true, delivered: false, confirmedExit: true, method: "taskkill", result };
    }

    if (result.error?.code === "ENOENT") {
      try {
        killImpl(pid);
        return { attempted: true, delivered: true, confirmedExit: false, method: "kill" };
      } catch (error) {
        if (error?.code === "ESRCH") {
          return { attempted: true, delivered: false, confirmedExit: true, method: "kill" };
        }
        throw error;
      }
    }

    if (result.error) {
      throw result.error;
    }

    throw new Error(formatCommandFailure(result));
  }

  const targets = [-pid, pid];
  let delivered = false;
  let gone = false;
  let method = null;
  try {
    delivered = signal(-pid, "SIGTERM");
    method = "process-group";
    gone = !delivered || waitUntilGone(-pid);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      delivered = signal(pid, "SIGTERM");
      method = "process";
      gone = !delivered || waitUntilGone(pid);
    } else {
      return { attempted: true, delivered: false, confirmedExit: true, method: "process-group" };
    }
  }

  if (!gone) {
    for (const target of targets) {
      try {
        const killed = signal(target, "SIGKILL");
        if (killed) {
          delivered = true;
          method = target < 0 ? "process-group-sigkill" : "process-sigkill";
          gone = waitUntilGone(target);
          if (gone) {
            break;
          }
        }
      } catch (error) {
        if (error?.code !== "ESRCH") {
          throw error;
        }
        gone = true;
      }
    }
  }

  return {
    attempted: true,
    delivered,
    confirmedExit: gone,
    method,
    escalated: method?.includes("sigkill") ?? false
  };
}

export function formatCommandFailure(result) {
  const parts = [`${result.command} ${result.args.join(" ")}`.trim()];
  if (result.signal) {
    parts.push(`signal=${result.signal}`);
  } else {
    parts.push(`exit=${result.status}`);
  }
  const stderr = (result.stderr || "").trim();
  const stdout = (result.stdout || "").trim();
  if (stderr) {
    parts.push(stderr);
  } else if (stdout) {
    parts.push(stdout);
  }
  return parts.join(": ");
}
