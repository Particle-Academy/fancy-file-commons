import { tok, type Token, type TokenType } from "./tokenizer";

/**
 * Minimal, dependency-free Markdown tokenizer for editor highlighting. Line-based
 * for block constructs (fences, headings, blockquotes, list markers) plus a few
 * safe, non-overlapping inline spans (code, bold/italic, links). Good enough to
 * read structure at a glance — not a full CommonMark parse.
 */
export function tokenizeMarkdown(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split("\n");
  let offset = 0;
  let inFence = false;

  for (const line of lines) {
    const base = offset;
    const len = line.length;
    offset += len + 1; // +1 for the consumed "\n"

    // Fenced code blocks — the fence line + everything inside is one string span.
    if (/^\s*(```|~~~)/.test(line)) {
      tokens.push(tok("string", base, base + len));
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      tokens.push(tok("string", base, base + len));
      continue;
    }

    // ATX heading — whole line.
    if (/^#{1,6}\s/.test(line)) {
      tokens.push(tok("keyword", base, base + len));
      continue;
    }

    // Blockquote — whole line.
    if (/^\s*>/.test(line)) {
      tokens.push(tok("comment", base, base + len));
      continue;
    }

    // List / task marker.
    const list = line.match(/^(\s*)([-*+]|\d+\.)\s/);
    if (list) {
      const start = base + list[1].length;
      tokens.push(tok("operator", start, start + list[2].length));
    }

    pushInline(line, base, tokens);
  }

  return tokens;
}

/** Collect non-overlapping inline spans (code, emphasis, links) in one line. */
function pushInline(line: string, base: number, out: Token[]): void {
  // Cosmetic highlighting only. The inline patterns below necessarily
  // backtrack, so skip pathologically long lines — this bounds total work to
  // O(n) across the document and prevents superlinear (ReDoS) blow-up on
  // adversarial input. Normal markdown lines are far below this threshold.
  if (line.length > 5000) return;

  const spans: Token[] = [];
  const add = (type: TokenType, start: number, end: number) => {
    spans.push(tok(type, base + start, base + end));
  };

  let m: RegExpExecArray | null;

  // Inline code `...`
  const code = /`[^`]+`/g;
  while ((m = code.exec(line))) add("string", m.index, m.index + m[0].length);

  // Bold/italic **...** *...* __...__ _..._
  const emph = /(\*\*|__)(?=\S)([\s\S]*?\S)\1|(\*|_)(?=\S)([\s\S]*?\S)\3/g;
  while ((m = emph.exec(line))) add("type", m.index, m.index + m[0].length);

  // Links / images [text](url)
  const link = /!?\[[^\]]*\]\(([^)]+)\)/g;
  while ((m = link.exec(line))) {
    add("tag", m.index, m.index + m[0].length - m[1].length - 1);
    const urlStart = m.index + m[0].length - m[1].length - 1;
    add("attributeValue", urlStart, urlStart + m[1].length);
  }

  // Order + drop overlaps (longest/earliest wins) so the renderer gets a clean list.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  let lastEnd = -1;
  for (const s of spans) {
    if (s.start >= lastEnd) {
      out.push(s);
      lastEnd = s.end;
    }
  }
}
