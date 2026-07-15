import type { Token, Tokenizer } from "./tokenizer";

/**
 * HTML/XML tokenizer. Walks char-by-char emitting tag punctuation, tag names,
 * attributes, quoted/unquoted attribute values, comments, and the doctype.
 * Pure and self-contained — the one syntax grammar `fancy-file-commons` ships,
 * because HTML is what the shared Editor source view needs. Richer language
 * grammars (JS/TS/PHP/Python/Go/Markdown) live in `fancy-code`.
 */
export const tokenizeHtml: Tokenizer = (source: string): Token[] => {
  const tokens: Token[] = [];
  const len = source.length;
  let i = 0;

  while (i < len) {
    // HTML comment
    if (source[i] === "<" && source.slice(i, i + 4) === "<!--") {
      const pos = i;
      i += 4;
      while (i < len && source.slice(i, i + 3) !== "-->") i++;
      i += 3;
      tokens.push({ type: "comment", start: pos, end: i });
      continue;
    }

    // Doctype
    if (source[i] === "<" && source.slice(i, i + 9).toUpperCase() === "<!DOCTYPE") {
      const pos = i;
      while (i < len && source[i] !== ">") i++;
      i++;
      tokens.push({ type: "keyword", start: pos, end: i });
      continue;
    }

    // Tag (opening or closing)
    if (source[i] === "<") {
      // Opening bracket
      tokens.push({ type: "punctuation", start: i, end: i + 1 });
      i++;

      // Closing slash
      if (i < len && source[i] === "/") {
        tokens.push({ type: "punctuation", start: i, end: i + 1 });
        i++;
      }

      // Tag name
      if (i < len && /[a-zA-Z]/.test(source[i])) {
        const pos = i;
        while (i < len && /[a-zA-Z0-9-]/.test(source[i])) i++;
        tokens.push({ type: "tag", start: pos, end: i });
      }

      // Attributes
      while (i < len && source[i] !== ">" && !(source[i] === "/" && source[i + 1] === ">")) {
        // Whitespace
        if (source[i] === " " || source[i] === "\t" || source[i] === "\n" || source[i] === "\r") {
          i++;
          continue;
        }

        // Attribute name
        if (/[a-zA-Z_@:]/.test(source[i])) {
          const pos = i;
          while (i < len && /[a-zA-Z0-9_\-:.]/.test(source[i])) i++;
          tokens.push({ type: "attribute", start: pos, end: i });

          // Skip whitespace around =
          while (i < len && (source[i] === " " || source[i] === "\t")) i++;

          // Equals sign
          if (i < len && source[i] === "=") {
            tokens.push({ type: "operator", start: i, end: i + 1 });
            i++;

            // Skip whitespace
            while (i < len && (source[i] === " " || source[i] === "\t")) i++;

            // Attribute value
            if (i < len && (source[i] === '"' || source[i] === "'")) {
              const quote = source[i];
              const pos = i;
              i++;
              while (i < len && source[i] !== quote) i++;
              i++;
              tokens.push({ type: "attributeValue", start: pos, end: i });
            } else if (i < len && /[^\s>]/.test(source[i])) {
              const pos = i;
              while (i < len && /[^\s>]/.test(source[i])) i++;
              tokens.push({ type: "attributeValue", start: pos, end: i });
            }
          }
          continue;
        }

        // Skip unknown chars inside tag
        i++;
      }

      // Self-closing slash
      if (i < len && source[i] === "/") {
        tokens.push({ type: "punctuation", start: i, end: i + 1 });
        i++;
      }

      // Closing bracket
      if (i < len && source[i] === ">") {
        tokens.push({ type: "punctuation", start: i, end: i + 1 });
        i++;
      }

      continue;
    }

    // Text content — skip to next tag or special
    const pos = i;
    while (i < len && source[i] !== "<") i++;
    if (i > pos) {
      tokens.push({ type: "plain", start: pos, end: i });
    }
  }

  return tokens;
};
