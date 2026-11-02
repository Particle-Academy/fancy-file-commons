import type { Token, Tokenizer } from "./tokenizer";

const KEYWORDS = new Set([
  "abstract", "arguments", "as", "async", "await", "boolean", "break", "byte",
  "case", "catch", "char", "class", "const", "continue", "debugger", "default",
  "delete", "do", "double", "else", "enum", "export", "extends", "false",
  "final", "finally", "float", "for", "from", "function", "get", "goto", "if",
  "implements", "import", "in", "instanceof", "int", "interface", "keyof", "let",
  "long", "native", "new", "null", "of", "package", "private", "protected",
  "public", "readonly", "return", "set", "short", "static", "super", "switch",
  "synchronized", "this", "throw", "throws", "transient", "true", "try",
  "type", "typeof", "undefined", "var", "void", "volatile", "while", "with",
  "yield",
]);

const TYPE_KEYWORDS = new Set([
  "string", "number", "boolean", "any", "void", "never", "unknown", "object",
  "symbol", "bigint", "undefined", "null",
]);

export const tokenizeJavaScript: Tokenizer = (source: string): Token[] => {
  const tokens: Token[] = [];
  const len = source.length;
  let i = 0;

  while (i < len) {
    const ch = source[i];

    // Whitespace — skip
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

    // Multi-line comment
    if (ch === "/" && source[i + 1] === "*") {
      const pos = i;
      i += 2;
      while (i < len && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      tokens.push({ type: "comment", start: pos, end: i });
      continue;
    }

    // Template literal
    if (ch === "`") {
      const pos = i;
      i++;
      while (i < len && source[i] !== "`") {
        if (source[i] === "\\") i++;
        i++;
      }
      i++; // closing backtick
      tokens.push({ type: "string", start: pos, end: i });
      continue;
    }

    // String (single or double quote)
    if (ch === '"' || ch === "'") {
      const pos = i;
      const quote = ch;
      i++;
      while (i < len && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
      i++; // closing quote
      tokens.push({ type: "string", start: pos, end: i });
      continue;
    }

    // Number
    if ((ch >= "0" && ch <= "9") || (ch === "." && source[i + 1] >= "0" && source[i + 1] <= "9")) {
      const pos = i;
      if (ch === "0" && (source[i + 1] === "x" || source[i + 1] === "X")) {
        i += 2;
        while (i < len && /[0-9a-fA-F_]/.test(source[i])) i++;
      } else if (ch === "0" && (source[i + 1] === "b" || source[i + 1] === "B")) {
        i += 2;
        while (i < len && /[01_]/.test(source[i])) i++;
      } else {
        while (i < len && /[0-9_.]/.test(source[i])) i++;
        if (i < len && (source[i] === "e" || source[i] === "E")) {
          i++;
          if (i < len && (source[i] === "+" || source[i] === "-")) i++;
          while (i < len && source[i] >= "0" && source[i] <= "9") i++;
        }
      }
      if (i < len && source[i] === "n") i++; // BigInt
      tokens.push({ type: "number", start: pos, end: i });
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_$]/.test(ch)) {
      const pos = i;
      i++;
      while (i < len && /[a-zA-Z0-9_$]/.test(source[i])) i++;
      const word = source.slice(pos, i);

      // Check if it's a function call (followed by parenthesis)
      let j = i;
      while (j < len && (source[j] === " " || source[j] === "\t")) j++;

      if (TYPE_KEYWORDS.has(word)) {
        tokens.push({ type: "type", start: pos, end: i });
      } else if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", start: pos, end: i });
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
    if ("+-*/%=<>!&|^~?:".includes(ch)) {
      const pos = i;
      i++;
      // Consume multi-char operators (===, !==, =>, &&, ||, ??, etc.)
      while (i < len && "+-*/%=<>!&|^~?:".includes(source[i])) i++;
      tokens.push({ type: "operator", start: pos, end: i });
      continue;
    }

    // Punctuation
    if ("(){}[];,.@#".includes(ch)) {
      tokens.push({ type: "punctuation", start: i, end: i + 1 });
      i++;
      continue;
    }

    // Anything else
    tokens.push({ type: "plain", start: i, end: i + 1 });
    i++;
  }

  return tokens;
};
