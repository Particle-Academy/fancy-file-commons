/**
 * Document diff engine — turns two strings (or line arrays) into the
 * structured `Diff` model: line-level LCS alignment, adjacent delete+insert
 * runs collapsed into `replace` hunks, and per-line word/char `segments`.
 *
 * Pure + deterministic. Hunk ids are derived from type + ranges + a content
 * hash (see `hash32`) — never random.
 */
import { diffSequences, type EditOp } from "./lcs";
import { hash32 } from "./hash";
import { diffLineSegments, defaultWordTokenizer } from "./segments";
import type {
  Diff,
  DiffLine,
  Hunk,
  HunkType,
  LineRange,
  WordTokenizer,
} from "./types";

export interface ComputeDiffOptions {
  /** Custom intra-line tokenizer for replace-hunk segments. */
  tokenizer?: WordTokenizer;
  /** Compute word/char segments for replace hunks. Default true. */
  segment?: boolean;
}

/** Split a document into lines, preserving content (no trailing-newline line). */
export function splitLines(doc: string): string[] {
  if (doc === "") return [];
  const lines = doc.split("\n");
  // A trailing newline produces a final empty element; drop it so a doc and
  // the same doc + "\n" diff cleanly at the line level.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

interface RawBlock {
  type: HunkType;
  removes: number[]; // before indices
  adds: number[]; // after indices
  equals: { b: number; a: number }[];
}

/** Group the flat edit script into typed blocks (collapsing remove+add -> replace). */
function groupBlocks(ops: EditOp[]): RawBlock[] {
  const blocks: RawBlock[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.op === "equal") {
      const equals: { b: number; a: number }[] = [];
      while (i < ops.length && ops[i].op === "equal") {
        const e = ops[i] as Extract<EditOp, { op: "equal" }>;
        equals.push({ b: e.beforeIndex, a: e.afterIndex });
        i++;
      }
      blocks.push({ type: "equal", removes: [], adds: [], equals });
    } else {
      // Gather a contiguous run of removes/adds — this is one change block.
      const removes: number[] = [];
      const adds: number[] = [];
      while (i < ops.length && ops[i].op !== "equal") {
        const o = ops[i];
        if (o.op === "remove") removes.push(o.beforeIndex);
        else if (o.op === "add") adds.push(o.afterIndex);
        i++;
      }
      let type: HunkType;
      if (removes.length && adds.length) type = "replace";
      else if (adds.length) type = "add";
      else type = "remove";
      blocks.push({ type, removes, adds, equals: [] });
    }
  }
  return blocks;
}

function range(indices: number[]): LineRange {
  if (indices.length === 0) return { start: 0, end: 0 };
  return { start: indices[0], end: indices[indices.length - 1] + 1 };
}

/** Compute a structured diff between two documents. */
export function computeDiff(
  before: string | string[],
  after: string | string[],
  options: ComputeDiffOptions = {},
): Diff {
  const beforeLines = Array.isArray(before) ? before : splitLines(before);
  const afterLines = Array.isArray(after) ? after : splitLines(after);
  return buildDiff(beforeLines, afterLines, options);
}

/** Build a Diff from already-split line arrays (shared with the unified parser). */
export function buildDiff(
  beforeLines: string[],
  afterLines: string[],
  options: ComputeDiffOptions = {},
): Diff {
  const { tokenizer = defaultWordTokenizer, segment = true } = options;
  const ops = diffSequences(beforeLines, afterLines);
  const blocks = groupBlocks(ops);
  const hunks: Hunk[] = [];

  blocks.forEach((block, blockIndex) => {
    const lines: DiffLine[] = [];

    if (block.type === "equal") {
      for (const e of block.equals) {
        lines.push({
          side: "both",
          text: beforeLines[e.b],
          beforeLineNo: e.b + 1,
          afterLineNo: e.a + 1,
        });
      }
    } else {
      for (const b of block.removes) {
        lines.push({ side: "before", text: beforeLines[b], beforeLineNo: b + 1 });
      }
      for (const a of block.adds) {
        lines.push({ side: "after", text: afterLines[a], afterLineNo: a + 1 });
      }
    }

    const beforeRange =
      block.type === "equal"
        ? range(block.equals.map((e) => e.b))
        : range(block.removes);
    const afterRange =
      block.type === "equal"
        ? range(block.equals.map((e) => e.a))
        : range(block.adds);

    const hunk: Hunk = {
      id: hunkId(block.type, blockIndex, lines.map((l) => l.text).join("\n")),
      type: block.type,
      beforeRange,
      afterRange,
      lines,
    };

    if (block.type === "replace" && segment) {
      const pairs = Math.min(block.removes.length, block.adds.length);
      const segs = [];
      for (let p = 0; p < pairs; p++) {
        segs.push(
          diffLineSegments(
            beforeLines[block.removes[p]],
            afterLines[block.adds[p]],
            p,
            tokenizer,
          ),
        );
      }
      if (segs.length) hunk.segments = segs;
    }

    hunks.push(hunk);
  });

  return { hunks };
}

/** Deterministic hunk id: type + position + content hash. */
export function hunkId(type: HunkType, index: number, content: string): string {
  return `h${index}-${type}-${hash32(`${type}:${index}:${content}`)}`;
}
