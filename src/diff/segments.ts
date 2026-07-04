/**
 * Intra-line word/char diff — highlights exactly what changed between a
 * paired before/after line in a `replace` hunk.
 *
 * Reuses the same LCS edit script over *tokens* instead of lines. The default
 * tokenizer splits on word boundaries while preserving whitespace, so
 * reassembling tokens reproduces the original line exactly. Consumers can
 * pass a custom tokenizer for char-level or language-aware highlighting.
 */
import { diffSequences } from "./lcs";
import type { DiffSegment, SegmentPair, WordTokenizer } from "./types";

/**
 * Default tokenizer: split into runs of word characters, runs of whitespace,
 * and individual punctuation chars. Concatenating the result === input.
 */
export const defaultWordTokenizer: WordTokenizer = (line: string): string[] => {
  // Match: word runs | whitespace runs | any single other char.
  const re = /[A-Za-z0-9_]+|\s+|[^A-Za-z0-9_\s]/g;
  return line.match(re) ?? [];
};

/** Coalesce adjacent same-op tokens into segment runs. */
function coalesce(tokens: { op: DiffSegment["op"]; text: string }[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const t of tokens) {
    if (t.text === "") continue;
    const last = out[out.length - 1];
    if (last && last.op === t.op) last.text += t.text;
    else out.push({ op: t.op, text: t.text });
  }
  return out;
}

/**
 * Diff one before/after line pair into before-side (equal+remove) and
 * after-side (equal+add) segment runs suitable for inline highlighting.
 */
export function diffLineSegments(
  beforeLine: string,
  afterLine: string,
  pairIndex: number,
  tokenizer: WordTokenizer = defaultWordTokenizer,
): SegmentPair {
  const beforeTokens = tokenizer(beforeLine);
  const afterTokens = tokenizer(afterLine);
  const ops = diffSequences(beforeTokens, afterTokens);

  const before: { op: DiffSegment["op"]; text: string }[] = [];
  const after: { op: DiffSegment["op"]; text: string }[] = [];

  for (const o of ops) {
    if (o.op === "equal") {
      before.push({ op: "equal", text: beforeTokens[o.beforeIndex] });
      after.push({ op: "equal", text: afterTokens[o.afterIndex] });
    } else if (o.op === "remove") {
      before.push({ op: "remove", text: beforeTokens[o.beforeIndex] });
    } else {
      after.push({ op: "add", text: afterTokens[o.afterIndex] });
    }
  }

  return {
    pairIndex,
    before: coalesce(before),
    after: coalesce(after),
  };
}
