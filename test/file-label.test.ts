import { test } from "node:test";
import assert from "node:assert/strict";
import { fileLabel } from "../src/diff/types";
import { parseUnifiedDiff } from "../src/diff/unified";

test("fileLabel: deletion uses the real oldPath, not /dev/null (#2)", () => {
  assert.equal(
    fileLabel({ oldPath: "src/components/AgentSettings.tsx", newPath: "/dev/null" }),
    "src/components/AgentSettings.tsx",
  );
});

test("fileLabel: addition uses newPath", () => {
  assert.equal(fileLabel({ oldPath: "/dev/null", newPath: "src/new.ts" }), "src/new.ts");
});

test("fileLabel: edit uses newPath (paths equal)", () => {
  assert.equal(fileLabel({ oldPath: "a.ts", newPath: "a.ts" }), "a.ts");
});

test("fileLabel: rename shows old → new", () => {
  assert.equal(fileLabel({ oldPath: "old.ts", newPath: "new.ts" }), "old.ts → new.ts");
});

test("fileLabel: no usable path → undefined", () => {
  assert.equal(fileLabel(undefined), undefined);
  assert.equal(fileLabel({ oldPath: "/dev/null", newPath: "/dev/null" }), undefined);
});

test("fileLabel: end-to-end on a parsed deletion diff", () => {
  const DELETION = `diff --git a/src/components/AgentSettings.tsx b/src/components/AgentSettings.tsx
deleted file mode 100644
--- a/src/components/AgentSettings.tsx
+++ /dev/null
@@ -1,2 +0,0 @@
-export const x = 1;
-export const y = 2;
`;
  const [diff] = parseUnifiedDiff(DELETION);
  assert.equal(fileLabel(diff.file), "src/components/AgentSettings.tsx");
});
