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
 * injection via user-supplied theme values. Exported as `safeCssColor` so any
 * surface writing a theme colour into a `style` attribute applies the same
 * allow-list.
 */
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d\s,.%/-]+\)|[a-zA-Z]+)$/;
export function safeCssColor(value: unknown): string {
  return typeof value === "string" && COLOR_RE.test(value.trim())
    ? value.trim()
    : "inherit";
}

/**
 * Every `ThemeColors` key, in declaration order (the optional diff marks
 * included). A surface that switches palettes with CSS needs one dark rule per
 * key; iterate this rather than retyping the list.
 */
export const THEME_COLOR_KEYS = [
  "background",
  "foreground",
  "gutterBackground",
  "gutterForeground",
  "gutterBorder",
  "activeLineBackground",
  "selectionBackground",
  "cursorColor",
  "diffAdded",
  "diffModified",
  "diffRemoved",
  "keyword",
  "string",
  "comment",
  "number",
  "operator",
  "function",
  "type",
  "tag",
  "attribute",
  "attributeValue",
  "punctuation",
  "variable",
] as const satisfies readonly (keyof ThemeColors)[];

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

/**
 * The CSS value that resolves palette slot `key` from custom properties:
 * `var(--fc-<key>,var(--fc-<key>-l))`. `--fc-<key>` is set by a dark rule on an
 * ancestor; until it is, the light value applies.
 */
export function themeColorVar(key: ThemeColorKey): string {
  return `var(--fc-${key},var(--fc-${key}-l))`;
}

/**
 * Both palettes as custom properties, for the `style` of a surface's root:
 * `--fc-<key>-l` (light) and `--fc-<key>-d` (dark) for every key the palette
 * sets. Every value passes `safeCssColor`, so a theme colour cannot smuggle a
 * second declaration (`red;background:url(..)`) into the attribute; a rejected
 * one becomes `inherit`. Keys a palette leaves out (the optional diff marks) are
 * omitted.
 */
export function themeVariables(light: ThemeColors, dark: ThemeColors): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of THEME_COLOR_KEYS) {
    if (light[key] !== undefined) out[`--fc-${key}-l`] = safeCssColor(light[key]);
    if (dark[key] !== undefined) out[`--fc-${key}-d`] = safeCssColor(dark[key]);
  }
  return out;
}

/** The palette slot each token type is coloured from. */
const TOKEN_COLOR_KEY: Record<TokenType, keyof ThemeColors> = {
  keyword: "keyword",
  string: "string",
  comment: "comment",
  number: "number",
  operator: "operator",
  function: "function",
  type: "type",
  tag: "tag",
  attribute: "attribute",
  attributeValue: "attributeValue",
  punctuation: "punctuation",
  variable: "variable",
  plain: "foreground",
};

/**
 * Convert source code + tokens + theme colors into highlighted HTML.
 * Returns an HTML string with `<span>` elements for each token, coloured inline
 * from ONE palette. With an empty token list it just returns the HTML-escaped
 * source — the "plaintext" path (e.g. Markdown, which is rendered
 * un-highlighted). For output that is right in both light and dark without
 * knowing the theme (server rendering), use `highlightCodeWithVariables`.
 */
export function highlightCode(source: string, tokens: Token[], colors: ThemeColors): string {
  return renderTokens(source, tokens, (type) => safeCssColor(colors[TOKEN_COLOR_KEY[type]]));
}

/**
 * Like `highlightCode`, but no colour value is written into the HTML: each span
 * reads `var(--fc-<key>,var(--fc-<key>-l))` (see `themeColorVar`). The surface
 * hosting it declares both palettes on an ancestor with `themeVariables(light,
 * dark)` and sets `--fc-<key>` to `var(--fc-<key>-d)` under its dark selector,
 * so the same server-rendered HTML is right in either theme and nothing flashes
 * on hydration. Without that dark rule it renders the light palette; without the
 * variables at all, tokens inherit the surrounding text colour.
 */
export function highlightCodeWithVariables(source: string, tokens: Token[]): string {
  return renderTokens(source, tokens, (type) => themeColorVar(TOKEN_COLOR_KEY[type]));
}

/**
 * Render `source` as escaped HTML, wrapping each token in a span coloured
 * `colorOf(token type)`; comments are also italic. Every slice emitted, inside
 * a span or between them, is HTML-escaped. `colorOf` must return a value that
 * is safe inside `style="..."` (an allow-listed colour, or a fixed `var()`).
 */
function renderTokens(source: string, tokens: Token[], colorOf: (type: TokenType) => string): string {
  if (tokens.length === 0) return escapeHtml(source);

  const parts: string[] = [];
  let pos = 0;

  for (const token of tokens) {
    // Never re-emit text an earlier token already covered, and never run past
    // the source: a token that overlaps its predecessor (PHP's HTML chunk with
    // an unterminated `<!--` reports an end inside the following `<?php`) is
    // trimmed to the part not yet rendered, so no character is duplicated.
    const start = Math.max(token.start, pos);
    const end = Math.min(token.end, source.length);
    if (end <= start) continue;

    // Plain text before this token
    if (start > pos) {
      parts.push(escapeHtml(source.slice(pos, start)));
    }

    const text = escapeHtml(source.slice(start, end));
    const color = colorOf(token.type);
    const style = token.type === "comment"
      ? `color:${color};font-style:italic`
      : `color:${color}`;

    parts.push(`<span style="${style}">${text}</span>`);
    pos = end;
  }

  // Remaining text after last token
  if (pos < source.length) {
    parts.push(escapeHtml(source.slice(pos)));
  }

  return parts.join("");
}
