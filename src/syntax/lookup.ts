import type { Token, Tokenizer } from "./tokenizer";
import { tokenizeHtml } from "./html";
import { tokenizeJavaScript } from "./javascript";
import { tokenizePhp, tokenizePhpSnippet } from "./php";
import { tokenizePython } from "./python";
import { tokenizeGo } from "./go";
import { tokenizeMarkdown } from "./markdown";
import { tokenizeShell } from "./shell";
import { tokenizeDotenv } from "./dotenv";

/** Canonical ids of every language this package can highlight. */
export const SYNTAX_LANGUAGES = [
  "javascript",
  "typescript",
  "html",
  "php",
  "python",
  "go",
  "markdown",
  "shell",
  "dotenv",
] as const;

export type SyntaxLanguage = (typeof SYNTAX_LANGUAGES)[number];

const TOKENIZERS: Record<SyntaxLanguage, Tokenizer> = {
  javascript: tokenizeJavaScript,
  // JS and TS are identical for highlighting purposes (TS type keywords are in
  // the JavaScript grammar's keyword sets).
  typescript: tokenizeJavaScript,
  html: tokenizeHtml,
  php: tokenizePhp,
  python: tokenizePython,
  go: tokenizeGo,
  markdown: tokenizeMarkdown,
  shell: tokenizeShell,
  dotenv: tokenizeDotenv,
};

/** Alias (lowercase, no leading dot) -> canonical id. Canonical ids map to themselves. */
const ALIASES: Record<string, SyntaxLanguage> = {
  javascript: "javascript", js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  // JSON: the JavaScript grammar colours keys/strings, numbers, true/false/null.
  json: "javascript", jsonc: "javascript", json5: "javascript",
  typescript: "typescript", ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  html: "html", htm: "html", xml: "html", xhtml: "html", vue: "html", svg: "html",
  php: "php", phtml: "php",
  python: "python", py: "python", pyw: "python",
  go: "go", golang: "go",
  markdown: "markdown", md: "markdown", mkd: "markdown", mdx: "markdown",
  shell: "shell", sh: "shell", bash: "shell", zsh: "shell", ksh: "shell", console: "shell", shellscript: "shell",
  dotenv: "dotenv", env: "dotenv",
};

/**
 * Resolve a language id or alias (`"ts"`, `"bash"`, `".env"`, `"JSON"`) to its
 * canonical id, or `null` when nothing here can highlight it.
 */
export function resolveSyntaxLanguage(language: string | null | undefined): SyntaxLanguage | null {
  if (typeof language !== "string") return null;
  const key = language.trim().toLowerCase().replace(/^\./, "");
  return Object.prototype.hasOwnProperty.call(ALIASES, key) ? ALIASES[key] : null;
}

/** The tokenizer for a language id or alias, or `null` when unknown. */
export function tokenizerFor(language: string | null | undefined): Tokenizer | null {
  const id = resolveSyntaxLanguage(language);
  return id ? TOKENIZERS[id] : null;
}

/**
 * Clean a token list for rendering: clamp every token to `[0, length]`, drop
 * empty tokens, and drop (or trim) any token that starts before the previous
 * one ended. The result is sorted, non-overlapping and in bounds, so the gaps
 * plus the tokens reassemble to exactly `source`. Tokenizers are allowed to be
 * sloppy at the edges (an unterminated comment can report an end past the
 * input); this is where that stops mattering.
 */
export function normalizeTokens(source: string, tokens: Token[]): Token[] {
  const len = source.length;
  const out: Token[] = [];
  let pos = 0;
  for (const t of tokens) {
    const start = Math.max(t.start, pos, 0);
    const end = Math.min(t.end, len);
    if (end <= start) continue;
    out.push({ type: t.type, start: start, end: end });
    pos = end;
  }
  return out;
}

/** Options for `tokenize`. */
export interface TokenizeOptions {
  /**
   * The code is a documentation snippet, not a whole file. Only PHP reads it
   * today: a snippet without an opening `<?php` starts in PHP mode instead of
   * inline HTML (see `tokenizePhpSnippet`). Display surfaces (react-fancy's
   * `CodeBlock`) pass it; file surfaces (an editor opening a `.php` file) must
   * not, because a file really is HTML until its first `<?php`.
   * @default false
   */
  snippet?: boolean;
}

/** Snippet-mode overrides; every other language tokenizes the same either way. */
const SNIPPET_TOKENIZERS: Partial<Record<SyntaxLanguage, Tokenizer>> = {
  php: tokenizePhpSnippet,
};

/**
 * Tokenize `code` as `language` (id or alias). Returns well-formed tokens (see
 * `normalizeTokens`), or `null` when the language is unknown, so callers can
 * fall back to plain text.
 */
export function tokenize(
  code: string,
  language: string | null | undefined,
  options?: TokenizeOptions,
): Token[] | null {
  const id = resolveSyntaxLanguage(language);
  if (!id) return null;
  const tokenizer = (options?.snippet === true ? SNIPPET_TOKENIZERS[id] : undefined) ?? TOKENIZERS[id];
  return normalizeTokens(code, tokenizer(code));
}
