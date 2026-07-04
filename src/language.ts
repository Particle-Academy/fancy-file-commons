/**
 * Filename → editor language resolution, shared by the editors and viewers
 * (fancy-code's CodeEditor / FileViewer, diff surfaces highlighting by path).
 * One extension map for the whole suite, so "what language is app.tsx?" has a
 * single answer everywhere.
 */
import { basename, extname } from "./path";

/**
 * Extension → language id. Ids follow fancy-code's registered aliases; only
 * languages with a real tokenizer are mapped — anything else falls through to
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
};

/**
 * Resolve the editor language for a filename. Returns `"plaintext"` (no
 * syntax highlighting) for unknown or extension-less files.
 */
export function languageFromFilename(filename?: string): string {
  if (!filename) return "plaintext";
  const seg = basename(filename);
  const dot = seg.lastIndexOf(".");
  if (dot <= 0) return "plaintext"; // no extension, or a dotfile like `.gitignore`
  const ext = extname(filename);
  return EXT_LANGUAGE[ext] ?? "plaintext";
}
