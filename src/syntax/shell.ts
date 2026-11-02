import { tok, type Token, type Tokenizer } from "./tokenizer";

/**
 * POSIX-ish shell tokenizer (sh / bash / zsh) for display highlighting.
 *
 * Emits: comments, single/double/backtick/`$'...'` strings, variables (`$VAR`,
 * `${...}`, `$1`, `$?`, assignment names) — including inside double quotes —
 * the leading command word of each command (`function`), control keywords,
 * flags (`-x`, `--flag=value`, as `attribute`), operators (`| && || ; > >>`
 * and friends), digits (`2>&1`, as `number`) and line continuations.
 *
 * Deliberately small: no heredoc bodies, no nested quoting inside `${...}`.
 * It never throws, and every token it emits is in bounds, non-empty and in
 * order, so gaps plus tokens reassemble exactly to the input.
 */

const KEYWORDS = new Set([
  "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done",
  "case", "esac", "function", "select", "time", "coproc", "!",
]);

/** Keywords whose next word names something rather than running it. */
const NAMING = new Set(["for", "select", "case", "function"]);
/** Keywords after which the command is over (`fi | cat`, `done > log`). */
const CLOSING = new Set(["fi", "done", "esac"]);

const SPECIAL_PARAMS = "@*#?$!-";

const isNameStart = (c: string | undefined) =>
  c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_");
const isNameChar = (c: string | undefined) => isNameStart(c) || (c !== undefined && c >= "0" && c <= "9");
const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

/** Characters that end an unquoted word. */
const isMeta = (c: string) =>
  c === " " || c === "\t" || c === "\r" || c === "\n" ||
  c === "|" || c === "&" || c === ";" || c === "(" || c === ")" || c === "<" || c === ">" ||
  c === "'" || c === '"' || c === "`";

/** Does a backslash at `i` start a line continuation? Returns its length (2 or 3) or 0. */
function continuationLength(source: string, i: number): number {
  if (source[i] !== "\\") return 0;
  if (source[i + 1] === "\n") return 2;
  if (source[i + 1] === "\r" && source[i + 2] === "\n") return 3;
  return 0;
}

/**
 * Length of a parameter expansion starting with `$` at `i`, or 0 when this `$`
 * is just a character. `stopAtQuote` keeps a `${...` inside double quotes from
 * running past the closing quote.
 */
function variableLength(source: string, i: number, stopAtQuote: boolean): number {
  const len = source.length;
  const next = source[i + 1];
  if (next === "{") {
    let j = i + 2;
    while (j < len && source[j] !== "}" && source[j] !== "\n" && !(stopAtQuote && source[j] === '"')) j++;
    if (j < len && source[j] === "}") j++;
    return j - i;
  }
  if (isNameStart(next)) {
    let j = i + 2;
    while (j < len && isNameChar(source[j])) j++;
    return j - i;
  }
  if (isDigit(next)) return 2;
  if (next !== undefined && SPECIAL_PARAMS.includes(next)) return 2;
  return 0;
}

/** End (exclusive) of a quoted run starting at `i`, honouring backslash escapes when `escapes`. */
function quotedEnd(source: string, i: number, quote: string, escapes: boolean): number {
  const len = source.length;
  let j = i + 1;
  while (j < len && source[j] !== quote) {
    if (escapes && source[j] === "\\") j++;
    j++;
  }
  return Math.min(j + 1, len);
}

export const tokenizeShell: Tokenizer = (source: string): Token[] => {
  const tokens: Token[] = [];
  const len = source.length;
  let i = 0;
  /** The next word to START is in command position. */
  let cmdPos = true;
  /** Inside `for x` / `case x` / `select x`, waiting for `in`. */
  let expectIn = false;

  const push = (type: Token["type"], s: number, e: number) => {
    if (e > s) tokens.push(tok(type, s, e));
  };
  const atWordStart = (p: number) => {
    if (p === 0) return true;
    const prev = source[p - 1];
    return prev === " " || prev === "\t" || prev === "\n" || prev === "\r" ||
      prev === ";" || prev === "|" || prev === "&" || prev === "(" || prev === ")" ||
      prev === "<" || prev === ">";
  };
  /** A word piece that is not plain text: when it begins a word, that word is now spent. */
  const wordPiece = (p: number) => {
    if (atWordStart(p)) cmdPos = false;
  };

  while (i < len) {
    const ch = source[i];

    // Newline ends the command.
    if (ch === "\n") {
      i++;
      cmdPos = true;
      expectIn = false;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      i++;
      continue;
    }

    // Line continuation: `\` + newline keeps the same command going.
    const cont = continuationLength(source, i);
    if (cont) {
      push("operator", i, i + 1);
      i += cont;
      continue;
    }

    // Comment — only where a word could start (`a#b` is a word).
    if (ch === "#" && atWordStart(i)) {
      let j = i;
      while (j < len && source[j] !== "\n") j++;
      const end = j > i && source[j - 1] === "\r" ? j - 1 : j;
      push("comment", i, end);
      i = j;
      continue;
    }

    // Operators.
    const two = source.slice(i, i + 2);
    if (two === "&&" || two === "||" || two === ";;" || two === "|&") {
      push("operator", i, i + 2);
      i += 2;
      cmdPos = true;
      expectIn = false;
      continue;
    }
    if (ch === ";" || ch === "|" || ch === "&") {
      push("operator", i, i + 1);
      i++;
      cmdPos = true;
      expectIn = false;
      continue;
    }
    if (ch === ">" || ch === "<") {
      const three = source.slice(i, i + 3);
      const n = three === "<<<" || three === "<<-" ? 3
        : two === ">>" || two === "<<" || two === ">&" || two === "<&" || two === ">|" || two === "<>" ? 2
        : 1;
      push("operator", i, i + n);
      i += n;
      continue;
    }
    if (ch === "(" || ch === ")") {
      push("punctuation", i, i + 1);
      i++;
      cmdPos = ch === "(";
      continue;
    }

    // Single-quoted: literal, no escapes, may span lines.
    if (ch === "'") {
      const end = quotedEnd(source, i, "'", false);
      wordPiece(i);
      push("string", i, end);
      i = end;
      continue;
    }

    // Backtick command substitution, shown as a string.
    if (ch === "`") {
      const end = quotedEnd(source, i, "`", true);
      wordPiece(i);
      push("string", i, end);
      i = end;
      continue;
    }

    // Double-quoted: string segments with variables highlighted inside.
    if (ch === '"') {
      wordPiece(i);
      let seg = i;
      let j = i + 1;
      while (j < len && source[j] !== '"') {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === "$") {
          const n = variableLength(source, j, true);
          if (n) {
            push("string", seg, j);
            push("variable", j, Math.min(j + n, len));
            j += n;
            seg = j;
            continue;
          }
        }
        j++;
      }
      const end = Math.min(j + 1, len);
      push("string", Math.min(seg, end), end);
      i = end;
      continue;
    }

    // `$`: expansions, `$(` / `$((` substitutions, `$'...'` strings.
    if (ch === "$") {
      if (source[i + 1] === "(") {
        const n = source[i + 2] === "(" ? 3 : 2;
        wordPiece(i);
        push("punctuation", i, i + n);
        i += n;
        cmdPos = n === 2; // `$(` runs a command; `$((` is arithmetic
        continue;
      }
      if (source[i + 1] === "'") {
        const end = quotedEnd(source, i + 1, "'", true);
        wordPiece(i);
        push("string", i, end);
        i = end;
        continue;
      }
      const n = variableLength(source, i, false);
      if (n) {
        wordPiece(i);
        push("variable", i, Math.min(i + n, len));
        i += n;
        continue;
      }
      // A bare `$` falls through and is read as part of a word.
    }

    // Unquoted word run: up to a metacharacter, a quote, or an expansion.
    const start = i;
    let j = i;
    while (j < len && !isMeta(source[j])) {
      if (source[j] === "\\") {
        if (continuationLength(source, j)) break;
        j = Math.min(j + 2, len);
        continue;
      }
      if (source[j] === "$" && j > start && (source[j + 1] === "(" || source[j + 1] === "'" || variableLength(source, j, false))) break;
      j++;
    }
    if (j === start) j = start + 1; // always advance
    const word = source.slice(start, j);
    i = j;

    if (!atWordStart(start)) continue; // continuation of a word already classified

    if (expectIn && word === "in") {
      push("keyword", start, j);
      expectIn = false;
      cmdPos = false;
      continue;
    }

    if (cmdPos) {
      if (KEYWORDS.has(word)) {
        push("keyword", start, j);
        if (NAMING.has(word)) {
          cmdPos = false;
          expectIn = word !== "function";
        } else if (CLOSING.has(word)) {
          cmdPos = false;
        }
        continue;
      }
      if (word === "{" || word === "}") {
        push("punctuation", start, j);
        cmdPos = word === "{";
        continue;
      }
      // Assignment prefix: NAME=value, NAME+=value, NAME[i]=value.
      if (isNameStart(word[0])) {
        let k = 1;
        while (k < word.length && isNameChar(word[k])) k++;
        if (word[k] === "[") {
          const close = word.indexOf("]", k);
          if (close !== -1) k = close + 1;
        }
        const opLen = word[k] === "=" ? 1 : word[k] === "+" && word[k + 1] === "=" ? 2 : 0;
        if (opLen) {
          push("variable", start, start + k);
          push("operator", start + k, start + k + opLen);
          // cmdPos stays true: `FOO=1 make` still runs `make`.
          continue;
        }
      }
      push("function", start, j);
      cmdPos = false;
      continue;
    }

    if (word[0] === "-") {
      push("attribute", start, j);
      continue;
    }
    let digits = true;
    for (let k = 0; k < word.length; k++) if (!isDigit(word[k])) digits = false;
    if (digits) push("number", start, j);
    // Anything else is a plain argument: left as a gap.
  }

  return tokens;
};
