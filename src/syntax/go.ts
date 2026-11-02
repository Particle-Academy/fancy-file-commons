import type { Token, Tokenizer } from "./tokenizer";

const KEYWORDS = new Set([
  "break", "case", "chan", "const", "continue", "default", "defer",
  "else", "fallthrough", "for", "func", "go", "goto", "if", "import",
  "interface", "map", "package", "range", "return", "select", "struct",
  "switch", "type", "var", "nil", "true", "false", "iota",
]);

const TYPES = new Set([
  "bool", "byte", "complex64", "complex128", "error", "float32", "float64",
  "int", "int8", "int16", "int32", "int64", "rune", "string",
  "uint", "uint8", "uint16", "uint32", "uint64", "uintptr", "any",
]);

const BUILTINS = new Set([
  "make", "len", "cap", "new", "append", "copy", "close", "delete",
  "complex", "real", "imag", "panic", "recover", "print", "println",
]);

export const tokenizeGo: Tokenizer = (source: string): Token[] => {
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

    // Single-line comment
    if (ch === "/" && source[i + 1] === "/") {
      const pos = i;
      i += 2;
      while (i < len && source[i] !== "\n") i++;
      tokens.push({ type: "comment", start: pos, end: i });
      continue;
    }

    // Block comment
    if (ch === "/" && source[i + 1] === "*") {
      const pos = i;
      i += 2;
      while (i < len && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      tokens.push({ type: "comment", start: pos, end: i });
      continue;
    }

    // Raw string literal (backtick)
    if (ch === "`") {
      const pos = i;
      i++;
      while (i < len && source[i] !== "`") i++;
      i++;
      tokens.push({ type: "string", start: pos, end: i });
      continue;
    }

    // Interpreted string
    if (ch === '"') {
      const pos = i;
      i++;
      while (i < len && source[i] !== '"' && source[i] !== "\n") {
        if (source[i] === "\\") i++;
        i++;
      }
      if (i < len && source[i] === '"') i++;
      tokens.push({ type: "string", start: pos, end: i });
      continue;
    }

    // Rune literal
    if (ch === "'") {
      const pos = i;
      i++;
      while (i < len && source[i] !== "'" && source[i] !== "\n") {
        if (source[i] === "\\") i++;
        i++;
      }
      if (i < len && source[i] === "'") i++;
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
      if (i < len && source[i] === "i") i++; // imaginary
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
      } else if (BUILTINS.has(word) && source[j] === "(") {
        tokens.push({ type: "function", start: pos, end: i });
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
    if ("+-*/%=<>!&|^~:".includes(ch)) {
      const pos = i;
      i++;
      while (i < len && "+-*/%=<>!&|^~:".includes(source[i])) i++;
      tokens.push({ type: "operator", start: pos, end: i });
      continue;
    }

    // Punctuation
    if ("(){}[];,.".includes(ch)) {
      tokens.push({ type: "punctuation", start: i, end: i + 1 });
      i++;
      continue;
    }

    tokens.push({ type: "plain", start: i, end: i + 1 });
    i++;
  }

  return tokens;
};
