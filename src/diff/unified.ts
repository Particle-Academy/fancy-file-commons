/**
 * Git unified-diff datasource.
 *
 * `parseUnifiedDiff(text)` parses a standard unified diff — including
 * multi-file `diff --git` output with `---` / `+++` headers and
 * `@@ -a,b +c,d @@` hunk headers — into the SAME structured `Diff` model
 * used by the in-house engine, one `Diff` per file.
 *
 * IMPORTANT LIMITATION: a unified diff does NOT contain the full documents,
 * only the changed hunks plus a few lines of surrounding context. Each
 * produced `Diff` is flagged `file.partial = true`. The hunks are faithful
 * (and inline word segments are still computed for replace blocks), but:
 *   - line numbers come from the `@@` header, not a re-scan of a full doc;
 *   - `getMergedResult()` over a partial diff only reconstructs the lines
 *     present in the diff window, not an entire file. Hosts that need a
 *     full merged file must supply the full `before` document separately.
 */
import { hunkId } from "./engine";
import { diffLineSegments, defaultWordTokenizer } from "./segments";
import type {
  Diff,
  DiffLine,
  Hunk,
  HunkType,
  SegmentPair,
  WordTokenizer,
} from "./types";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export interface ParseUnifiedOptions {
  tokenizer?: WordTokenizer;
  segment?: boolean;
}

/** Strip a leading `a/` or `b/` git path prefix. */
function cleanPath(p: string | undefined): string | undefined {
  if (!p) return p;
  const trimmed = p.replace(/\t.*$/, "").trim();
  if (trimmed === "/dev/null") return trimmed;
  return trimmed.replace(/^[ab]\//, "");
}

interface RawHunkLine {
  prefix: " " | "+" | "-";
  text: string;
}

/** Turn one parsed `@@` hunk's raw lines into structured Hunk(s). */
function emitHunks(
  rawLines: RawHunkLine[],
  beforeStart: number,
  afterStart: number,
  fileIndex: number,
  hunkSeq: { n: number },
  opts: Required<ParseUnifiedOptions>,
): Hunk[] {
  const out: Hunk[] = [];
  let bNo = beforeStart;
  let aNo = afterStart;

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];

    if (line.prefix === " ") {
      // Context run -> equal hunk.
      const lines: DiffLine[] = [];
      const bStart = bNo;
      const aStart = aNo;
      while (i < rawLines.length && rawLines[i].prefix === " ") {
        lines.push({
          side: "both",
          text: rawLines[i].text,
          beforeLineNo: bNo,
          afterLineNo: aNo,
        });
        bNo++;
        aNo++;
        i++;
      }
      out.push(
        makeHunk("equal", fileIndex, hunkSeq, lines, {
          start: bStart - 1,
          end: bNo - 1,
        }, { start: aStart - 1, end: aNo - 1 }, opts),
      );
    } else {
      // A change run: contiguous removes then adds (git groups them this way,
      // but we tolerate interleaving by collecting all - then all + in the run).
      const removes: { text: string; no: number }[] = [];
      const adds: { text: string; no: number }[] = [];
      while (i < rawLines.length && rawLines[i].prefix !== " ") {
        if (rawLines[i].prefix === "-") {
          removes.push({ text: rawLines[i].text, no: bNo });
          bNo++;
        } else {
          adds.push({ text: rawLines[i].text, no: aNo });
          aNo++;
        }
        i++;
      }

      let type: HunkType;
      if (removes.length && adds.length) type = "replace";
      else if (adds.length) type = "add";
      else type = "remove";

      const lines: DiffLine[] = [
        ...removes.map((r) => ({ side: "before" as const, text: r.text, beforeLineNo: r.no })),
        ...adds.map((a) => ({ side: "after" as const, text: a.text, afterLineNo: a.no })),
      ];

      const beforeRange = removes.length
        ? { start: removes[0].no - 1, end: removes[removes.length - 1].no }
        : { start: bNo - 1, end: bNo - 1 };
      const afterRange = adds.length
        ? { start: adds[0].no - 1, end: adds[adds.length - 1].no }
        : { start: aNo - 1, end: aNo - 1 };

      const hunk = makeHunk(type, fileIndex, hunkSeq, lines, beforeRange, afterRange, opts);

      if (type === "replace" && opts.segment) {
        const pairs = Math.min(removes.length, adds.length);
        const segs: SegmentPair[] = [];
        for (let p = 0; p < pairs; p++) {
          segs.push(diffLineSegments(removes[p].text, adds[p].text, p, opts.tokenizer));
        }
        if (segs.length) hunk.segments = segs;
      }

      out.push(hunk);
    }
  }

  return out;
}

function makeHunk(
  type: HunkType,
  fileIndex: number,
  hunkSeq: { n: number },
  lines: DiffLine[],
  beforeRange: { start: number; end: number },
  afterRange: { start: number; end: number },
  _opts: Required<ParseUnifiedOptions>,
): Hunk {
  const index = hunkSeq.n++;
  return {
    id: `f${fileIndex}-${hunkId(type, index, lines.map((l) => l.text).join("\n"))}`,
    type,
    beforeRange,
    afterRange,
    lines,
  };
}

/**
 * Parse a (possibly multi-file) unified diff into one `Diff` per file.
 * Returns an empty array for input with no recognizable hunks.
 */
export function parseUnifiedDiff(
  text: string,
  options: ParseUnifiedOptions = {},
): Diff[] {
  const opts: Required<ParseUnifiedOptions> = {
    tokenizer: options.tokenizer ?? defaultWordTokenizer,
    segment: options.segment ?? true,
  };

  const lines = text.split("\n");
  // A diff string normally ends with a trailing newline, which split() turns
  // into a final empty element. Drop it so it isn't mistaken for an empty
  // context line appended to the last hunk.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  const diffs: Diff[] = [];

  // Held in an object so closures that mutate it don't let TS narrow the
  // outer reference to `never` after a `state.current == null` check.
  const state: { current: Diff | null } = { current: null };
  let fileIndex = -1;
  let hunkSeq = { n: 0 };

  // Pending hunk accumulation.
  let inHunk = false;
  let hunkBeforeStart = 0;
  let hunkAfterStart = 0;
  let hunkRaw: RawHunkLine[] = [];

  let oldPath: string | undefined;
  let newPath: string | undefined;

  const startFile = (): Diff => {
    fileIndex++;
    hunkSeq = { n: 0 };
    const next: Diff = { hunks: [], file: { partial: true } };
    diffs.push(next);
    state.current = next;
    oldPath = undefined;
    newPath = undefined;
    return next;
  };

  /** Return the current file, starting one if none is open. */
  const ensureFile = (): Diff => state.current ?? startFile();

  const flushHunk = () => {
    if (!inHunk || !state.current) return;
    const emitted = emitHunks(
      hunkRaw,
      hunkBeforeStart,
      hunkAfterStart,
      fileIndex,
      hunkSeq,
      opts,
    );
    state.current.hunks.push(...emitted);
    inHunk = false;
    hunkRaw = [];
  };

  for (const raw of lines) {
    if (raw.startsWith("diff --git")) {
      flushHunk();
      const file = startFile();
      const m = raw.match(/^diff --git (\S+) (\S+)/);
      if (m) {
        oldPath = cleanPath(m[1]);
        newPath = cleanPath(m[2]);
        file.file = { oldPath, newPath, partial: true };
      }
      continue;
    }

    if (raw.startsWith("--- ")) {
      flushHunk();
      // A `---` with no preceding `diff --git` still starts a new file.
      const open: Diff | null = state.current;
      const file =
        !open || open.hunks.length || inHunk ? startFile() : open;
      oldPath = cleanPath(raw.slice(4));
      file.file = { ...file.file, oldPath, partial: true };
      continue;
    }

    if (raw.startsWith("+++ ")) {
      newPath = cleanPath(raw.slice(4));
      const file = ensureFile();
      file.file = { ...file.file, newPath, partial: true };
      continue;
    }

    const hm = raw.match(HUNK_HEADER);
    if (hm) {
      flushHunk();
      ensureFile();
      hunkBeforeStart = parseInt(hm[1], 10);
      hunkAfterStart = parseInt(hm[3], 10);
      inHunk = true;
      hunkRaw = [];
      continue;
    }

    if (inHunk) {
      if (raw.startsWith("\\")) continue; // "\ No newline at end of file"
      const c = raw[0];
      if (c === "+" || c === "-" || c === " ") {
        hunkRaw.push({ prefix: c as " " | "+" | "-", text: raw.slice(1) });
      } else if (raw === "") {
        // Blank line inside a hunk is a context line with empty text.
        hunkRaw.push({ prefix: " ", text: "" });
      } else {
        // Non-diff trailer (e.g. next file's `index` line) — end of hunk.
        flushHunk();
      }
    }
  }

  flushHunk();
  return diffs.filter((d) => d.hunks.length > 0 || d.file);
}
