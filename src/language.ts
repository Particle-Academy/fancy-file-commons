/**
 * Filename → editor language resolution, shared by the editors and viewers
 * (fancy-code's CodeEditor / FileViewer, diff surfaces highlighting by path).
 * One extension map for the whole suite, so "what language is app.tsx?" has a
 * single answer everywhere.
 */
import { basename, extname } from "./path";

/**
 * Extension → language id. Ids are the canonical ids of this package's own
 * grammars (`SYNTAX_LANGUAGES`), so every value here has a tokenizer —
 * `tokenizerFor(EXT_LANGUAGE[ext])` is never null; a test enforces it. JSON
 * maps to the JavaScript grammar. Anything unmapped falls through to
 * `"plaintext"` (rendered un-highlighted). SVG is intentionally absent: it
 * resolves to a media image, not text.
 */
export const EXT_LANGUAGE: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  json: "javascript", // the JS tokenizer highlights JSON acceptably
  jsonc: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  html: "html",
  htm: "html",
  xml: "html",
  xhtml: "html",
  vue: "html",
  php: "php",
  phtml: "php",
  py: "python",
  pyw: "python",
  go: "go",
  md: "markdown",
  markdown: "markdown",
  mkd: "markdown",
  mdx: "markdown",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ksh: "shell",
  env: "dotenv",
};

/**
 * Whole-basename matches for files an extension cannot identify: dotenv files
 * (`.env`, `.env.local`, `.env.example`, ...) and shell rc files.
 */
const DOTFILE_LANGUAGE: Record<string, string> = {
  ".bashrc": "shell",
  ".bash_profile": "shell",
  ".bash_aliases": "shell",
  ".profile": "shell",
  ".zshrc": "shell",
  ".zprofile": "shell",
  ".zshenv": "shell",
};

/**
 * Resolve the editor language for a filename. Returns `"plaintext"` (no
 * syntax highlighting) for unknown or extension-less files. Every language it
 * can return has a tokenizer (`tokenizerFor`) in this package.
 */
export function languageFromFilename(filename?: string): string {
  if (!filename) return "plaintext";
  const seg = basename(filename);
  const lower = seg.toLowerCase();
  if (lower === ".env" || lower.startsWith(".env.")) return "dotenv";
  if (Object.prototype.hasOwnProperty.call(DOTFILE_LANGUAGE, lower)) return DOTFILE_LANGUAGE[lower];
  const dot = seg.lastIndexOf(".");
  if (dot <= 0) return "plaintext"; // no extension, or a dotfile like `.gitignore`
  const ext = extname(filename);
  return EXT_LANGUAGE[ext] ?? "plaintext";
}
