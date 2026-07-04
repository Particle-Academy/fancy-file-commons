import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUnifiedDiff } from "../src/diff/unified";
import { mergeResult } from "../src/diff/merge";

const SAMPLE = `diff --git a/greeting.txt b/greeting.txt
index 83db48f..f735c2d 100644
--- a/greeting.txt
+++ b/greeting.txt
@@ -1,4 +1,4 @@
 hello
-world
+there
 keep me
 last line
`;

test("parseUnifiedDiff: single file, headers + hunks", () => {
  const diffs = parseUnifiedDiff(SAMPLE);
  assert.equal(diffs.length, 1);
  const d = diffs[0];
  assert.equal(d.file?.oldPath, "greeting.txt");
  assert.equal(d.file?.newPath, "greeting.txt");
  assert.equal(d.file?.partial, true);
  // context (equal) + replace + context
  const types = d.hunks.map((h) => h.type);
  assert.ok(types.includes("replace"));
  assert.ok(types.includes("equal"));
});

test("parseUnifiedDiff: line numbers come from @@ header", () => {
  const diffs = parseUnifiedDiff(SAMPLE);
  const replace = diffs[0].hunks.find((h) => h.type === "replace")!;
  const before = replace.lines.find((l) => l.side === "before")!;
  const after = replace.lines.find((l) => l.side === "after")!;
  assert.equal(before.text, "world");
  assert.equal(after.text, "there");
  assert.equal(before.beforeLineNo, 2);
  assert.equal(after.afterLineNo, 2);
});

test("parseUnifiedDiff: replace carries inline segments", () => {
  const diffs = parseUnifiedDiff(SAMPLE);
  const replace = diffs[0].hunks.find((h) => h.type === "replace")!;
  assert.ok(replace.segments && replace.segments.length >= 1);
});

test("parseUnifiedDiff: multi-file", () => {
  const multi = `diff --git a/one.txt b/one.txt
--- a/one.txt
+++ b/one.txt
@@ -1,2 +1,2 @@
 a
-b
+B
diff --git a/two.txt b/two.txt
--- a/two.txt
+++ b/two.txt
@@ -1,1 +1,2 @@
 x
+y
`;
  const diffs = parseUnifiedDiff(multi);
  assert.equal(diffs.length, 2);
  assert.equal(diffs[0].file?.newPath, "one.txt");
  assert.equal(diffs[1].file?.newPath, "two.txt");
  // hunk ids are namespaced per-file so they never collide
  const allIds = diffs.flatMap((d) => d.hunks.map((h) => h.id));
  assert.equal(new Set(allIds).size, allIds.length);
});

test("unified round-trip: accept-all reproduces the after window", () => {
  const diffs = parseUnifiedDiff(SAMPLE);
  const d = diffs[0];
  const acceptAll: Record<string, "accepted"> = {};
  for (const h of d.hunks) if (h.type !== "equal") acceptAll[h.id] = "accepted";
  const merged = mergeResult(d, acceptAll);
  assert.equal(merged, "hello\nthere\nkeep me\nlast line");
});

test("unified round-trip: reject-all reproduces the before window", () => {
  const diffs = parseUnifiedDiff(SAMPLE);
  const d = diffs[0];
  const merged = mergeResult(d, {}, { defaultStatus: "rejected" });
  assert.equal(merged, "hello\nworld\nkeep me\nlast line");
});

test("addition-only unified hunk", () => {
  const add = `--- a/f.txt
+++ b/f.txt
@@ -1,1 +1,2 @@
 keep
+new
`;
  const diffs = parseUnifiedDiff(add);
  const addHunk = diffs[0].hunks.find((h) => h.type === "add")!;
  assert.equal(addHunk.lines[0].text, "new");
  assert.equal(addHunk.lines[0].afterLineNo, 2);
});
