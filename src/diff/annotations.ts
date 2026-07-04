/**
 * Line annotations — fold a structured `Diff` into per-line gutter marks for
 * the AFTER document: which lines are `added`, which are `modified`, and how
 * many before-lines were deleted immediately above each line. This is the
 * model an editor gutter (fancy-code), a compact diff rail, or a minimap
 * consumes — derived once here so every file surface agrees on what a
 * "changed line" is.
 *
 * Pure + deterministic, like the rest of the diff core. JSON-friendly output
 * (plain records, no Maps) so it can cross an MCP bridge untouched.
 */
import { computeDiff, type ComputeDiffOptions } from "./engine";
import type { Diff } from "./types";

/** How a line in the after document differs from the before document. */
export type LineChangeType = "added" | "modified";

/** Annotation for one after-document line (1-based). Sparse — only changed lines appear. */
export interface LineAnnotation {
  /** The line's own change, if any. */
  type?: LineChangeType;
  /** Count of before-lines deleted immediately ABOVE this line. */
  deletedAbove?: number;
}

/** Per-line gutter model for one diff. */
export interface DiffAnnotations {
  /** after-line-no (1-based) -> annotation. Sparse; unchanged lines are absent. */
  byLine: Record<number, LineAnnotation>;
  /** Before-lines deleted after the last after-line (a deletion at EOF). */
  deletedAtEnd: number;
  /** Total lines added. */
  added: number;
  /** Total lines modified (the paired portion of replace hunks). */
  modified: number;
  /** Total lines removed. */
  removed: number;
}

/**
 * Derive per-line annotations from a structured diff.
 *
 * Semantics per hunk type (walking hunks in order, tracking the after cursor):
 * - `equal`   — advances the cursor; carries no marks.
 * - `add`     — every added line is `added`.
 * - `replace` — every after line is `modified`; when more lines were removed
 *   than added, the surplus counts as a deletion attached to the next line.
 * - `remove`  — the removed count attaches as `deletedAbove` on the NEXT
 *   after line (or `deletedAtEnd` when nothing follows).
 */
export function diffAnnotations(diff: Diff): DiffAnnotations {
  const byLine: Record<number, LineAnnotation> = {};
  let added = 0;
  let modified = 0;
  let removed = 0;
  /** Deletions waiting to attach to the next emitted after line. */
  let pendingDeleted = 0;

  const annotate = (line: number, patch: LineAnnotation): void => {
    byLine[line] = { ...byLine[line], ...patch };
  };

  /** Attach any pending deletions above the given after line. */
  const flushDeleted = (line: number): void => {
    if (pendingDeleted > 0) {
      annotate(line, { deletedAbove: (byLine[line]?.deletedAbove ?? 0) + pendingDeleted });
      pendingDeleted = 0;
    }
  };

  for (const hunk of diff.hunks) {
    if (hunk.type === "equal") {
      const first = hunk.afterRange.start + 1;
      if (hunk.afterRange.end > hunk.afterRange.start) flushDeleted(first);
      continue;
    }

    if (hunk.type === "add") {
      for (let l = hunk.afterRange.start + 1; l <= hunk.afterRange.end; l++) {
        if (l === hunk.afterRange.start + 1) flushDeleted(l);
        annotate(l, { type: "added" });
        added++;
      }
      continue;
    }

    if (hunk.type === "remove") {
      pendingDeleted += hunk.beforeRange.end - hunk.beforeRange.start;
      removed += hunk.beforeRange.end - hunk.beforeRange.start;
      continue;
    }

    // replace — paired lines are modified; surplus removals become a deletion.
    const addCount = hunk.afterRange.end - hunk.afterRange.start;
    const removeCount = hunk.beforeRange.end - hunk.beforeRange.start;
    for (let l = hunk.afterRange.start + 1; l <= hunk.afterRange.end; l++) {
      if (l === hunk.afterRange.start + 1) flushDeleted(l);
      annotate(l, { type: "modified" });
    }
    modified += Math.min(addCount, removeCount);
    if (addCount > removeCount) {
      // More lines added than removed — the surplus counts as additions.
      added += addCount - removeCount;
    } else if (removeCount > addCount) {
      pendingDeleted += removeCount - addCount;
      removed += removeCount - addCount;
    }
  }

  return { byLine, deletedAtEnd: pendingDeleted, added, modified, removed };
}

/**
 * Convenience: diff two documents and derive line annotations in one call —
 * what an editor gutter runs on every change. Intra-line segmentation is
 * skipped (the gutter never needs it), keeping the recompute cheap.
 */
export function annotateLines(
  before: string | string[],
  after: string | string[],
  options: Omit<ComputeDiffOptions, "segment"> = {},
): DiffAnnotations {
  return diffAnnotations(computeDiff(before, after, { ...options, segment: false }));
}
