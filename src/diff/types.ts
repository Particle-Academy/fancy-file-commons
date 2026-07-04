/**
 * Structured diff model — engine-agnostic, JSON-friendly, deterministic.
 *
 * A `Diff` is a flat ordered list of `Hunk`s. Each hunk describes one
 * contiguous region of the comparison: an unchanged run (`equal`), an
 * insertion (`add`), a deletion (`remove`), or a paired delete+insert
 * (`replace`). Replace hunks may additionally carry intra-line word/char
 * `segments` so the UI can highlight exactly what changed within a line.
 *
 * Everything here is plain data: no functions, no class instances, no
 * `Math.random`. Hunk ids are derived from indices + a content hash so the
 * same inputs always yield the same ids (stable handles for agents).
 */

/** What a hunk represents relative to before -> after. */
export type HunkType = "equal" | "add" | "remove" | "replace";

/** A half-open range of line indices `[start, end)` into a document. */
export interface LineRange {
  /** First line index (0-based, inclusive). */
  start: number;
  /** One past the last line index (exclusive). `start === end` means empty. */
  end: number;
}

/** Origin of a rendered line within a hunk. */
export type LineSide = "before" | "after" | "both";

/** A single rendered line inside a hunk. */
export interface DiffLine {
  /** "before" = removed/context-left, "after" = added/context-right, "both" = equal context. */
  side: LineSide;
  /** Line text (no trailing newline). */
  text: string;
  /** Line number in the before document (1-based), if applicable. */
  beforeLineNo?: number;
  /** Line number in the after document (1-based), if applicable. */
  afterLineNo?: number;
}

/** Intra-line token diff op for a `replace` hunk. */
export type SegmentOp = "equal" | "add" | "remove";

/** A run of tokens sharing one op, for inline highlighting. */
export interface DiffSegment {
  op: SegmentOp;
  /** Concatenated token text for this run. */
  text: string;
}

/** Word/char segments for one before/after line pair in a replace hunk. */
export interface SegmentPair {
  /** Index of the paired line within the replace block (0-based). */
  pairIndex: number;
  /** Segments to render on the before side (equal + remove ops). */
  before: DiffSegment[];
  /** Segments to render on the after side (equal + add ops). */
  after: DiffSegment[];
}

/** One contiguous diff region. */
export interface Hunk {
  /** Deterministic, content-derived stable id (no randomness). */
  id: string;
  type: HunkType;
  /** Range of affected lines in the before document. */
  beforeRange: LineRange;
  /** Range of affected lines in the after document. */
  afterRange: LineRange;
  /** Rendered lines (context for `equal`, removed+added for `replace`, etc.). */
  lines: DiffLine[];
  /** Optional intra-line word/char segmentation for `replace` hunks. */
  segments?: SegmentPair[];
}

/** A full diff between two documents (or one file of a unified diff). */
export interface Diff {
  hunks: Hunk[];
  /** Optional file metadata (set by the unified-diff parser). */
  file?: DiffFileMeta;
}

/** File-level metadata, primarily from git unified diffs. */
export interface DiffFileMeta {
  /** Old path (`---` header / `a/...`). */
  oldPath?: string;
  /** New path (`+++` header / `b/...`). */
  newPath?: string;
  /**
   * True when the source is a git unified diff, which contains only the
   * changed hunks + a few context lines — NOT the full documents. Consumers
   * should not call `getMergedResult` expecting a complete file when this is
   * set; the merge is only meaningful over the lines present in the diff.
   */
  partial?: boolean;
}

/**
 * The display path for a file header. Prefers the side that isn't `/dev/null`,
 * so a **deletion** (`newPath === "/dev/null"`) shows its real `oldPath`, an
 * **addition** shows `newPath`, and a **rename** shows `oldPath → newPath`.
 * Returns `undefined` when there's no usable path. (#2)
 */
export function fileLabel(file?: DiffFileMeta): string | undefined {
  const newPath = file?.newPath && file.newPath !== "/dev/null" ? file.newPath : undefined;
  const oldPath = file?.oldPath && file.oldPath !== "/dev/null" ? file.oldPath : undefined;
  if (newPath && oldPath && newPath !== oldPath) return `${oldPath} → ${newPath}`;
  return newPath ?? oldPath;
}

/** Acceptance status for a single hunk. */
export type AcceptanceStatus = "accepted" | "rejected" | "pending";

/** Controlled acceptance state: hunkId -> status. */
export type AcceptanceState = Record<string, AcceptanceStatus>;

/** Optional custom tokenizer for intra-line segmentation. */
export type WordTokenizer = (line: string) => string[];
