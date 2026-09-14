import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import assert from "node:assert/strict";
import {
  legalActions,
  transition,
  positionKey,
  validateState,
  code,
} from "../src/engine.mjs";

const child = spawn(
  process.env.AOC_PYTHON || ".venv/bin/python",
  ["web/tests/oracle.py"],
  { stdio: ["ignore", "pipe", "inherit"] },
);
const completion = new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (c) =>
    c === 0 ? resolve() : reject(Error(`Python exited ${c}`)),
  );
});
let count = 0,
  actions = 0;
let last = null;
try {
  for await (const line of createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  })) {
    const sample = JSON.parse(line);
    const before = { ...sample.before, counts: {} };
    // Preserve full history across consecutive plies; study positions reset it.
    before.counts =
      last &&
      last.ply === before.ply &&
      positionKey(last) === positionKey(before)
        ? last.counts
        : { [positionKey(before)]: 1 };
    const actual = legalActions(before);
    assert.deepEqual(actual, sample.legal, `Legal actions at sample ${count}`);
    actions += actual.length;
    if (sample.action) {
      const result = transition(before, sample.action),
        { counts, ...after } = result.state;
      assert.deepEqual(after, sample.after, `Transition at sample ${count}`);
      validateState(result.state);
      assert.equal(result.event.approach ?? null, sample.approach);
      assert.equal(result.event.stance ?? null, sample.stance);
      const losses = result.event.losses.map((l) => ({
        code: code(l.unit),
        side: l.unit > 0 ? "north" : "south",
        cause: l.cause,
      }));
      assert.deepEqual(losses, sample.losses, `Casualties at sample ${count}`);
      last = result.state;
    } else last = null;
    count++;
  }
  await completion;
  assert(count > 5000);
  console.log(
    JSON.stringify({ positions: count, legalActions: actions, failures: 0 }),
  );
} catch (error) {
  child.kill();
  await completion.catch(() => {});
  throw error;
}
