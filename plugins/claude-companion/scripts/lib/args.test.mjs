import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs, splitRawArgumentString } from "./args.mjs";

test("stopAtFirstPositional keeps flags inside focus text opaque", () => {
  const argv = splitRawArgumentString(
    "--background Review build command: build.py --variant v6.2 --model pm_v6_2"
  );
  const { options, positionals } = parseArgs(argv, {
    valueOptions: ["model", "effort"],
    booleanOptions: ["background"],
    stopAtFirstPositional: true
  });

  assert.equal(options.background, true);
  assert.equal(options.model, undefined);
  assert.equal(positionals.join(" "), "Review build command: build.py --variant v6.2 --model pm_v6_2");
});

test("explicit option prefix still parses before prompt text", () => {
  const argv = splitRawArgumentString("--model sonnet --effort high investigate --model mention");
  const { options, positionals } = parseArgs(argv, {
    valueOptions: ["model", "effort"],
    stopAtFirstPositional: true
  });

  assert.equal(options.model, "sonnet");
  assert.equal(options.effort, "high");
  assert.equal(positionals.join(" "), "investigate --model mention");
});
