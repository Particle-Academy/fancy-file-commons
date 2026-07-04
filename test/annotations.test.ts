import { test } from "node:test";
import assert from "node:assert/strict";
import { annotateLines, diffAnnotations } from "../src/diff/annotations";
import { computeDiff } from "../src/diff/engine";

test("no changes -> empty annotations", () => {
  const a = annotateLines("a\nb\nc", "a\nb\nc");
  assert.deepEqual(a.byLine, {});
  assert.equal(a.deletedAtEnd, 0);
  assert.equal(a.added + a.modified + a.removed, 0);
});

test("pure addition marks the new lines added", () => {
  const a = annotateLines("a\nc", "a\nb\nb2\nc");
  assert.deepEqual(a.byLine[2], { type: "added" });
  assert.deepEqual(a.byLine[3], { type: "added" });
  assert.equal(a.byLine[1], undefined);
  assert.equal(a.byLine[4], undefined);
  assert.equal(a.added, 2);
  assert.equal(a.modified, 0);
  assert.equal(a.removed, 0);
});

test("pure deletion attaches deletedAbove to the next line", () => {
  const a = annotateLines("a\nx\ny\nb", "a\nb");
  // x + y deleted between a (line 1) and b (line 2).
  assert.deepEqual(a.byLine[2], { deletedAbove: 2 });
  assert.equal(a.removed, 2);
  assert.equal(a.deletedAtEnd, 0);
});

test("deletion at EOF lands in deletedAtEnd", () => {
  const a = annotateLines("a\nb\nx", "a\nb");
  assert.deepEqual(a.byLine, {});
  assert.equal(a.deletedAtEnd, 1);
  assert.equal(a.removed, 1);
});

test("deletion at start attaches to line 1", () => {
  const a = annotateLines("x\na\nb", "a\nb");
  assert.deepEqual(a.byLine[1], { deletedAbove: 1 });
});

test("replace marks after lines modified", () => {
  const a = annotateLines("a\nOLD\nc", "a\nNEW\nc");
  assert.deepEqual(a.byLine[2], { type: "modified" });
  assert.equal(a.modified, 1);
  assert.equal(a.added, 0);
  assert.equal(a.removed, 0);
});

test("uneven replace: surplus removals attach as a deletion on the following line", () => {
  // two lines replaced by one -> line 2 modified, 1 surplus removal above line 3.
  const a = annotateLines("a\nOLD1\nOLD2\nc", "a\nNEW\nc");
  assert.equal(a.byLine[2]?.type, "modified");
  assert.equal(a.byLine[3]?.deletedAbove, 1);
  assert.equal(a.modified, 1);
  assert.equal(a.removed, 1);
});

test("uneven replace: surplus additions count as added", () => {
  const a = annotateLines("a\nOLD\nc", "a\nNEW1\nNEW2\nc");
  assert.equal(a.byLine[2]?.type, "modified");
  assert.equal(a.byLine[3]?.type, "modified");
  assert.equal(a.modified, 1);
  assert.equal(a.added, 1);
});

test("empty before -> everything added", () => {
  const a = annotateLines("", "a\nb");
  assert.deepEqual(a.byLine[1], { type: "added" });
  assert.deepEqual(a.byLine[2], { type: "added" });
  assert.equal(a.added, 2);
});

test("empty after -> everything deleted at end", () => {
  const a = annotateLines("a\nb", "");
  assert.deepEqual(a.byLine, {});
  assert.equal(a.deletedAtEnd, 2);
  assert.equal(a.removed, 2);
});

test("diffAnnotations agrees with annotateLines over the same diff", () => {
  const before = "one\ntwo\nthree\nfour";
  const after = "one\n2\nthree\nfive\nsix";
  const fromDiff = diffAnnotations(computeDiff(before, after, { segment: false }));
  const direct = annotateLines(before, after);
  assert.deepEqual(fromDiff, direct);
});

test("annotations are deterministic", () => {
  const a1 = annotateLines("a\nb\nc", "a\nB\nc\nd");
  const a2 = annotateLines("a\nb\nc", "a\nB\nc\nd");
  assert.deepEqual(a1, a2);
});
