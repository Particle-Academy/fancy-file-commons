import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDiff, splitLines } from "../src/diff/engine";
import { diffLineSegments } from "../src/diff/segments";

test("line diff: pure addition", () => {
  const diff = computeDiff("a\nb", "a\nb\nc");
  const types = diff.hunks.map((h) => h.type);
  assert.deepEqual(types, ["equal", "add"]);
  const add = diff.hunks[1];
  assert.equal(add.lines.length, 1);
  assert.equal(add.lines[0].text, "c");
  assert.equal(add.lines[0].side, "after");
  assert.equal(add.afterRange.start, 2);
  assert.equal(add.afterRange.end, 3);
});

test("line diff: pure removal", () => {
  const diff = computeDiff("a\nb\nc", "a\nc");
  const types = diff.hunks.map((h) => h.type);
  assert.deepEqual(types, ["equal", "remove", "equal"]);
  assert.equal(diff.hunks[1].lines[0].text, "b");
  assert.equal(diff.hunks[1].lines[0].side, "before");
});

test("line diff: replace collapses delete+insert", () => {
  const diff = computeDiff("the quick fox", "the slow fox");
  // single line replaced -> one replace hunk
  const replace = diff.hunks.find((h) => h.type === "replace");
  assert.ok(replace, "expected a replace hunk");
  assert.equal(replace!.lines.filter((l) => l.side === "before").length, 1);
  assert.equal(replace!.lines.filter((l) => l.side === "after").length, 1);
});

test("deterministic ids: same input -> same ids, no randomness", () => {
  const a = computeDiff("a\nb\nc", "a\nX\nc");
  const b = computeDiff("a\nb\nc", "a\nX\nc");
  assert.deepEqual(
    a.hunks.map((h) => h.id),
    b.hunks.map((h) => h.id),
  );
  // ids encode index + type
  const change = a.hunks.find((h) => h.type !== "equal")!;
  assert.match(change.id, /^h\d+-(add|remove|replace)-[a-z0-9]+$/);
});

test("word-segment diff highlights only the changed token", () => {
  const seg = diffLineSegments("the quick brown fox", "the quick red fox", 0);
  // before side should mark "brown" removed, after side "red" added
  const beforeRemoved = seg.before.filter((s) => s.op === "remove").map((s) => s.text);
  const afterAdded = seg.after.filter((s) => s.op === "add").map((s) => s.text);
  assert.deepEqual(beforeRemoved, ["brown"]);
  assert.deepEqual(afterAdded, ["red"]);
  // equal runs reconstruct the rest
  const beforeJoined = seg.before.map((s) => s.text).join("");
  assert.equal(beforeJoined, "the quick brown fox");
  const afterJoined = seg.after.map((s) => s.text).join("");
  assert.equal(afterJoined, "the quick red fox");
});

test("replace hunk carries segments", () => {
  const diff = computeDiff("hello world", "hello there");
  const replace = diff.hunks.find((h) => h.type === "replace")!;
  assert.ok(replace.segments && replace.segments.length === 1);
  const afterAdded = replace.segments![0].after.filter((s) => s.op === "add").map((s) => s.text);
  assert.deepEqual(afterAdded, ["there"]);
});

test("splitLines drops a single trailing newline", () => {
  assert.deepEqual(splitLines("a\nb\n"), ["a", "b"]);
  assert.deepEqual(splitLines("a\nb"), ["a", "b"]);
  assert.deepEqual(splitLines(""), []);
});
