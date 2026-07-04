import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDiff } from "../src/diff/engine";
import { mergeResult, setAllStatus } from "../src/diff/merge";
import type { AcceptanceState } from "../src/diff/types";

const BEFORE = "line1\nline2\nline3\nline4";
const AFTER = "line1\nCHANGED2\nline3\nline4\nline5";

test("merge: all pending == original document", () => {
  const diff = computeDiff(BEFORE, AFTER);
  assert.equal(mergeResult(diff, {}, { defaultStatus: "pending" }), BEFORE);
});

test("merge: accept all == target document", () => {
  const diff = computeDiff(BEFORE, AFTER);
  const accept = setAllStatus(diff, "accepted");
  assert.equal(mergeResult(diff, accept), AFTER);
});

test("merge: reject all == original document", () => {
  const diff = computeDiff(BEFORE, AFTER);
  const reject = setAllStatus(diff, "rejected");
  assert.equal(mergeResult(diff, reject), BEFORE);
});

test("merge: mix of accepted + rejected hunks", () => {
  const diff = computeDiff(BEFORE, AFTER);
  const replace = diff.hunks.find((h) => h.type === "replace");
  const add = diff.hunks.find((h) => h.type === "add");
  assert.ok(replace, "expected replace hunk (line2 -> CHANGED2)");
  assert.ok(add, "expected add hunk (line5)");

  // Accept the replace, reject the addition.
  const state: AcceptanceState = {
    [replace!.id]: "accepted",
    [add!.id]: "rejected",
  };
  assert.equal(mergeResult(diff, state), "line1\nCHANGED2\nline3\nline4");

  // Reject the replace, accept the addition.
  const state2: AcceptanceState = {
    [replace!.id]: "rejected",
    [add!.id]: "accepted",
  };
  assert.equal(mergeResult(diff, state2), "line1\nline2\nline3\nline4\nline5");
});

test("merge: removal accepted drops the line", () => {
  const diff = computeDiff("keep\ndrop\nkeep2", "keep\nkeep2");
  const remove = diff.hunks.find((h) => h.type === "remove")!;
  assert.equal(mergeResult(diff, { [remove.id]: "accepted" }), "keep\nkeep2");
  assert.equal(mergeResult(diff, { [remove.id]: "rejected" }), "keep\ndrop\nkeep2");
});
