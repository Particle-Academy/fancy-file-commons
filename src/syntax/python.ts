import type { Token, Tokenizer } from "./tokenizer";

const KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from",
  "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield",
  "True", "False", "None",
]);

const TYPES = new Set([
  "int", "str", "float", "bool", "list", "dict", "tuple", "set",
  "bytes", "bytearray", "memoryview", "range", "frozenset",
  "complex", "type", "object", "property", "classmethod", "staticmethod",
  "Any", "Optional", "Union", "Callable", "List", "Dict", "Tuple", "Set",
  "Sequence", "Mapping", "Iterator", "Generator", "Coroutine",
]);

export const tokenizePython: Tokenizer = (source: string): Token[] => {
  const tokens: Token[] = [];
  const len = source.length;
  let i = 0;

  while (i < len) {
    const ch = source[i];

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // Comment
    if (ch === "#") {
      const pos = i;
      i++;
      while (i < len && source[i] !== "\n") i++;
      tokens.push({ type: "comment", start: pos, end: i });
      continue;
    }

    // Decorator
    if (ch === "@" && i + 1 < len && /[a-zA-Z_]/.test(source[i + 1])) {
      const pos = i;
      i++;
      while (i < len && /[a-zA-Z0-9_.]/.test(source[i])) i++;
      tokens.push({ type: "keyword", start: pos, end: i });
      continue;
    }

    // String (check for prefix + triple or single quote)
    if (
      ch === '"' || ch === "'" ||
      ((ch === "f" || ch === "r" || ch === "b" || ch === "F" || ch === "R" || ch === "B") &&
        (source[i + 1] === '"' || source[i + 1] === "'"))
    ) {
      const pos = i;
      // Skip prefix
      if (ch !== '"' && ch !== "'") i++;

      const quote = source[i];

      // Triple-quoted string
      if (source[i + 1] === quote && source[i + 2] === quote) {
        const triple = quote + quote + quote;
        i += 3;
        while (i < len && source.slice(i, i + 3) !== triple) {
          if (source[i] === "\\") i++;
          i++;
        }
        i += 3;
        tokens.push({ type: "string", start: pos, end: i });
        continue;
      }

      // Single-line string
      i++;
      while (i < len && source[i] !== quote && source[i] !== "\n") {
        if (source[i] === "\\") i++;
        i++;
      }
      if (i < len && source[i] === quote) i++;
      tokens.push({ type: "string", start: pos, end: i });
      continue;
    }

    // Number
    if ((ch >= "0" && ch <= "9") || (ch === "." && i + 1 < len && source[i + 1] >= "0" && source[i + 1] <= "9")) {
      const pos = i;
      if (ch === "0" && (source[i + 1] === "x" || source[i + 1] === "X")) {
        i += 2;
        while (i < len && /[0-9a-fA-F_]/.test(source[i])) i++;
      } else if (ch === "0" && (source[i + 1] === "b" || source[i + 1] === "B")) {
        i += 2;
        while (i < len && /[01_]/.test(source[i])) i++;
      } else if (ch === "0" && (source[i + 1] === "o" || source[i + 1] === "O")) {
        i += 2;
        while (i < len && /[0-7_]/.test(source[i])) i++;
      } else {
        while (i < len && /[0-9_.]/.test(source[i])) i++;
        if (i < len && (source[i] === "e" || source[i] === "E")) {
          i++;
          if (i < len && (source[i] === "+" || source[i] === "-")) i++;
          while (i < len && source[i] >= "0" && source[i] <= "9") i++;
        }
      }
      if (i < len && source[i] === "j") i++; // complex
      tokens.push({ type: "number", start: pos, end: i });
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(ch)) {
      const pos = i;
      i++;
      while (i < len && /[a-zA-Z0-9_]/.test(source[i])) i++;
      const word = source.slice(pos, i);

      let j = i;
      while (j < len && (source[j] === " " || source[j] === "\t")) j++;

      if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", start: pos, end: i });
      } else if (TYPES.has(word)) {
        tokens.push({ type: "type", start: pos, end: i });
      } else if (source[j] === "(") {
        tokens.push({ type: "function", start: pos, end: i });
      } else if (word[0] >= "A" && word[0] <= "Z") {
        tokens.push({ type: "type", start: pos, end: i });
      } else {
        tokens.push({ type: "variable", start: pos, end: i });
      }
      continue;
    }

    // Operators
    if ("+-*/%=<>!&|^~:@".includes(ch)) {
      const pos = i;
      i++;
      while (i < len && "+-*/%=<>!&|^~:".includes(source[i])) i++;
      tokens.push({ type: "operator", start: pos, end: i });
      continue;
    }

    // Punctuation
    if ("()[]{},.;\\".includes(ch)) {
      tokens.push({ type: "punctuation", start: i, end: i + 1 });
      i++;
      continue;
    }

    tokens.push({ type: "plain", start: i, end: i + 1 });
    i++;
  }

  return tokens;
};
