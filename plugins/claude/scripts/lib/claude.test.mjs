import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";

import { runClaudeTurn } from "./claude.mjs";

test("runClaudeTurn moves from starting to running immediately after spawn", async () => {
  const events = [];
  const child = new EventEmitter();
  child.pid = 12345;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();

  const resultPromise = runClaudeTurn(process.cwd(), {
    prompt: "Return JSON.",
    permissionMode: "dontAsk",
    progressIntervalMs: false,
    spawnImpl: () => child,
    onProgress: (event) => events.push(event)
  });

  child.stdout.end('{"result":"{\\"verdict\\":\\"approve\\",\\"summary\\":\\"ok\\",\\"findings\\":[],\\"next_steps\\":[]}","session_id":"s1"}');
  child.emit("exit", 0, null);

  const result = await resultPromise;
  assert.equal(result.status, 0);
  assert.deepEqual(
    events.map((event) => event.phase),
    ["starting", "running", "finalizing"]
  );
  assert.match(events[1].message, /pid 12345/);
});

