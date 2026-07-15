import type { Token, TokenType } from "./tokenizer";
import type { ThemeColors } from "./theme";

/** Escape HTML special characters. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Validate a CSS color value. Allows hex (#abc, #abcdef, #abcdef00), rgb()/
 * rgba()/hsl()/hsla() with safe characters, and bare CSS color keywords.
 * Returns the color if safe, or "inherit" otherwise — preventing CSS
 * injection via user-supplied theme values.
 */
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d\s,.%/-]+\)|[a-zA-Z]+)$/;
function safeColor(value: unknown): string {
  return typeof value === "string" && COLOR_RE.test(value.trim())
    ? value.trim()
    : "inherit";
}

/**
 * Convert source code + tokens + theme colors into highlighted HTML.
 * Returns an HTML string with `<span>` elements for each token. With an empty
 * token list it just returns the HTML-escaped source — the "plaintext" path
 * (e.g. Markdown, which is rendered un-highlighted).
 */
export function highlightCode(source: string, tokens: Token[], colors: ThemeColors): string {
  if (tokens.length === 0) return escapeHtml(source);

  const colorMap: Record<TokenType, string> = {
    keyword: colors.keyword,
    string: colors.string,
    comment: colors.comment,
    number: colors.number,
    operator: colors.operator,
    function: colors.function,
    type: colors.type,
    tag: colors.tag,
    attribute: colors.attribute,
    attributeValue: colors.attributeValue,
    punctuation: colors.punctuation,
    variable: colors.variable,
    plain: colors.foreground,
  };

  const parts: string[] = [];
  let pos = 0;

  for (const token of tokens) {
    // Plain text before this token
    if (token.start > pos) {
      parts.push(escapeHtml(source.slice(pos, token.start)));
    }

    const text = escapeHtml(source.slice(token.start, token.end));
    const color = safeColor(colorMap[token.type]);
    const style = token.type === "comment"
      ? `color:${color};font-style:italic`
      : `color:${color}`;

    parts.push(`<span style="${style}">${text}</span>`);
    pos = token.end;
  }

  // Remaining text after last token
  if (pos < source.length) {
    parts.push(escapeHtml(source.slice(pos)));
  }

  return parts.join("");
}
