import type { Token, Tokenizer } from "./tokenizer";
import { tokenizeHtml } from "./html";

const PHP_KEYWORDS = new Set([
  "abstract", "and", "array", "as", "break", "callable", "case", "catch",
  "class", "clone", "const", "continue", "declare", "default", "do", "echo",
  "else", "elseif", "empty", "enddeclare", "endfor", "endforeach", "endif",
  "endswitch", "endwhile", "enum", "eval", "exit", "extends", "false", "final",
  "finally", "fn", "for", "foreach", "function", "global", "goto", "if",
  "implements", "include", "include_once", "instanceof", "insteadof",
  "interface", "isset", "list", "match", "namespace", "new", "null", "or",
  "print", "private", "protected", "public", "readonly", "require",
  "require_once", "return", "self", "static", "switch", "throw", "trait",
  "true", "try", "unset", "use", "var", "while", "xor", "yield",
]);

function tokenizePhpBlock(source: string, offset: number): { tokens: Token[]; end: number } {
  const tokens: Token[] = [];
  const len = source.length;
  let i = offset;

  while (i < len) {
    const ch = source[i];

    // End of PHP block
    if (ch === "?" && source[i + 1] === ">") {
      return { tokens, end: i };
    }

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // Single-line comment (// or #)
    if ((ch === "/" && source[i + 1] === "/") || ch === "#") {
      const pos = i;
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

    // Variable ($name)
    if (ch === "$") {
      const pos = i;
      i++;
      while (i < len && /[a-zA-Z0-9_]/.test(source[i])) i++;
      tokens.push({ type: "variable", start: pos, end: i });
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
      i++;
      tokens.push({ type: "string", start: pos, end: i });
      continue;
    }

    // Number
    if (ch >= "0" && ch <= "9") {
      const pos = i;
      while (i < len && /[0-9_.]/.test(source[i])) i++;
      if (i < len && (source[i] === "e" || source[i] === "E")) {
        i++;
        if (i < len && (source[i] === "+" || source[i] === "-")) i++;
        while (i < len && source[i] >= "0" && source[i] <= "9") i++;
      }
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

      if (PHP_KEYWORDS.has(word.toLowerCase())) {
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
    if ("+-*/%=<>!&|^~?:.".includes(ch)) {
      const pos = i;
      i++;
      while (i < len && "+-*/%=<>!&|^~?:.".includes(source[i])) i++;
      tokens.push({ type: "operator", start: pos, end: i });
      continue;
    }

    // Punctuation
    if ("(){}[];,@\\".includes(ch)) {
      tokens.push({ type: "punctuation", start: i, end: i + 1 });
      i++;
      continue;
    }

    tokens.push({ type: "plain", start: i, end: i + 1 });
    i++;
  }

  return { tokens, end: i };
}

export const tokenizePhp: Tokenizer = (source: string): Token[] => {
  const tokens: Token[] = [];
  const len = source.length;
  let i = 0;
  let htmlChunkStart = 0;

  while (i < len) {
    // Detect PHP open tag
    if (source[i] === "<" && source[i + 1] === "?") {
      // Tokenize any HTML before this PHP block
      if (i > htmlChunkStart) {
        const htmlChunk = source.slice(htmlChunkStart, i);
        const htmlTokens = tokenizeHtml(htmlChunk);
        for (const t of htmlTokens) {
          tokens.push({ type: t.type, start: t.start + htmlChunkStart, end: t.end + htmlChunkStart });
        }
      }

      // PHP open tag
      const tagStart = i;
      i += 2;
      // Skip "php" or "="
      if (i < len && source.slice(i, i + 3).toLowerCase() === "php") {
        i += 3;
      } else if (i < len && source[i] === "=") {
        i++;
      }
      tokens.push({ type: "keyword", start: tagStart, end: i });

      // Tokenize PHP content
      const result = tokenizePhpBlock(source, i);
      tokens.push(...result.tokens);
      i = result.end;

      // PHP close tag
      if (i < len && source[i] === "?" && source[i + 1] === ">") {
        tokens.push({ type: "keyword", start: i, end: i + 2 });
        i += 2;
      }

      htmlChunkStart = i;
      continue;
    }

    i++;
  }

  // Remaining HTML after last PHP block
  if (htmlChunkStart < len) {
    const htmlChunk = source.slice(htmlChunkStart);
    const htmlTokens = tokenizeHtml(htmlChunk);
    for (const t of htmlTokens) {
      tokens.push({ type: t.type, start: t.start + htmlChunkStart, end: t.end + htmlChunkStart });
    }
  }

  return tokens;
};
