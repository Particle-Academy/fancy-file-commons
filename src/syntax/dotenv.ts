import { tok, type Token, type Tokenizer } from "./tokenizer";

/**
 * `.env` (dotenv) tokenizer for display highlighting.
 *
 * Emits: `# comments` (whole-line, and inline after an unquoted or quoted value
 * when preceded by whitespace), the `export` prefix (`keyword`), `KEY`
 * (`attribute`), `=` (`operator`), values (`string`) — double-quoted values may
 * span lines and highlight `${VAR}` / `$VAR` (`variable`) inside, single- and
 * backtick-quoted values are literal, unquoted values also interpolate.
 *
 * An unterminated quote ends at the end of its line rather than swallowing the
 * rest of the file. Never throws; every token is in bounds, non-empty and in
 * order. Lines that are not `KEY=value` are left as plain text.
 */

const isKeyChar = (c: string | undefined) =>
  c !== undefined &&
  ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_" || c === "." || c === "-");
const isNameStart = (c: string | undefined) =>
  c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_");
const isNameChar = (c: string | undefined) => isNameStart(c) || (c !== undefined && c >= "0" && c <= "9");

/** End of the line starting at or after `i`, excluding a trailing `\r`. */
function lineEnd(source: string, i: number): { end: number; next: number } {
  let j = i;
  while (j < source.length && source[j] !== "\n") j++;
  const end = j > i && source[j - 1] === "\r" ? j - 1 : j;
  return { end, next: j < source.length ? j + 1 : j };
}

/** Length of `${...}` or `$NAME` at `i`, bounded by `limit`; 0 when not an expansion. */
function variableLength(source: string, i: number, limit: number): number {
  const next = source[i + 1];
  if (i + 1 >= limit) return 0;
  if (next === "{") {
    let j = i + 2;
    while (j < limit && source[j] !== "}") j++;
    if (j < limit) j++;
    return j - i;
  }
  if (isNameStart(next)) {
    let j = i + 2;
    while (j < limit && isNameChar(source[j])) j++;
    return j - i;
  }
  return 0;
}

export const tokenizeDotenv: Tokenizer = (source: string): Token[] => {
  const tokens: Token[] = [];
  const len = source.length;
  const push = (type: Token["type"], s: number, e: number) => {
    if (e > s) tokens.push(tok(type, s, e));
  };

  /** String segments over [a, b) with `$` expansions split out as variables. */
  const interpolated = (a: number, b: number, escapes: boolean) => {
    let seg = a;
    let j = a;
    while (j < b) {
      if (escapes && source[j] === "\\") {
        j += 2;
        continue;
      }
      if (source[j] === "$") {
        const n = variableLength(source, j, b);
        if (n) {
          push("string", seg, j);
          push("variable", j, j + n);
          j += n;
          seg = j;
          continue;
        }
      }
      j++;
    }
    push("string", seg, Math.min(b, len));
  };

  /** After a value: optional whitespace, then an inline `# comment`. */
  const trailing = (from: number, end: number) => {
    let j = from;
    while (j < end && (source[j] === " " || source[j] === "\t")) j++;
    if (j < end && source[j] === "#" && j > from) push("comment", j, end);
  };

  let i = 0;
  while (i < len) {
    const { end, next } = lineEnd(source, i);
    let j = i;
    while (j < end && (source[j] === " " || source[j] === "\t")) j++;

    if (j >= end) {
      i = next;
      continue;
    }

    if (source[j] === "#") {
      push("comment", j, end);
      i = next;
      continue;
    }

    if (source.startsWith("export", j) && (source[j + 6] === " " || source[j + 6] === "\t")) {
      push("keyword", j, j + 6);
      j += 6;
      while (j < end && (source[j] === " " || source[j] === "\t")) j++;
    }

    const keyStart = j;
    while (j < end && isKeyChar(source[j])) j++;
    const keyEnd = j;
    while (j < end && (source[j] === " " || source[j] === "\t")) j++;
    if (keyEnd === keyStart || source[j] !== "=") {
      // Not KEY=value: leave the line as plain text.
      i = next;
      continue;
    }
    push("attribute", keyStart, keyEnd);
    push("operator", j, j + 1);
    j++;
    while (j < end && (source[j] === " " || source[j] === "\t")) j++;

    const q = source[j];
    if (j < end && (q === '"' || q === "'" || q === "`")) {
      // Find the closing quote, across lines; unterminated stops at this line.
      let k = j + 1;
      while (k < len && source[k] !== q) {
        if (q === '"' && source[k] === "\\") k++;
        k++;
      }
      if (k >= len) {
        if (q === '"') interpolated(j, end, true);
        else push("string", j, end);
        i = next;
        continue;
      }
      const close = k + 1;
      if (q === '"') interpolated(j, close, true);
      else push("string", j, close);
      // Continue on the line the closing quote is on.
      const after = lineEnd(source, close);
      trailing(close, after.end);
      i = after.next;
      continue;
    }

    // Unquoted: up to an inline comment (` #`), trailing whitespace trimmed.
    let v = j;
    while (v < end && !(source[v] === "#" && v > j && (source[v - 1] === " " || source[v - 1] === "\t"))) v++;
    let valueEnd = v;
    while (valueEnd > j && (source[valueEnd - 1] === " " || source[valueEnd - 1] === "\t")) valueEnd--;
    interpolated(j, valueEnd, false);
    if (v < end) push("comment", v, end);
    i = next;
  }

  return tokens;
};
