import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function ensureAbsolutePath(cwd, maybePath) {
  return path.isAbsolute(maybePath) ? maybePath : path.resolve(cwd, maybePath);
}

export function createTempDir(prefix = "claude-plugin-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function safeReadFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

export function resolveFileWithinDirectory(cwd, filePath, label = "file") {
  const root = fs.realpathSync(cwd);
  const resolved = path.resolve(cwd, filePath);
  const realPath = fs.realpathSync(resolved);
  const relative = path.relative(root, realPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to read ${label} outside the working directory: ${filePath}`);
  }
  const stat = fs.statSync(realPath);
  if (!stat.isFile()) {
    throw new Error(`${label} must be a file: ${filePath}`);
  }
  return realPath;
}

export function isProbablyText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  for (const value of sample) {
    if (value === 0) {
      return false;
    }
  }
  return true;
}

export function readStdinIfPiped() {
  if (process.stdin.isTTY) {
    return "";
  }
  try {
    process.stdin._handle?.setBlocking?.(true);
  } catch {
    // Some stdin handles do not expose setBlocking.
  }

  let delayMs = 10;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return fs.readFileSync(0, "utf8");
    } catch (error) {
      if (error?.code !== "EAGAIN" || attempt === 7) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
      delayMs = Math.min(delayMs * 2, 500);
    }
  }
  return "";
}
