# Changelog

Notable changes to `@particle-academy/fancy-file-commons`.

**BREAKING** marks anything that can stop working on upgrade. This package is
pre-1.0, so breaking changes land in MINOR releases — read those entries before
upgrading.

> Entries below **1.0** were reconstructed from git history when this file was
> introduced, so they summarise commit subjects rather than consumer impact.
> Everything from the next release onward is written by hand, in the same commit
> as the change.

---

## [Unreleased]

## [0.4.0] - 2026-11-02

### Added

- **Every syntax grammar now lives here.** The JavaScript (also TypeScript and JSON), PHP, Python, Go and Markdown tokenizers moved from `fancy-code`, unchanged, beside the existing HTML one: `tokenizeJavaScript`, `tokenizePhp`, `tokenizePython`, `tokenizeGo`, `tokenizeMarkdown`. Before this, `EXT_LANGUAGE` named five languages whose tokenizers this package did not ship, and react-fancy (which `fancy-code` depends on, so it cannot import `fancy-code`) could only highlight HTML.
- **Two new grammars: `tokenizeShell`** (`sh` / `bash` / `zsh`: comments, single/double/backtick/`$'...'` strings with `$VAR` and `${VAR}` highlighted inside double quotes, variables and assignments, the leading command word, keywords, `-x` / `--flag` flags, `| && || ; > >>` operators, line continuations) **and `tokenizeDotenv`** (`.env`: comments, `export`, `KEY`, `=`, quoted and unquoted values, `${VAR}` interpolation, inline comments). Both never throw and emit in-bounds, ordered, non-overlapping tokens.
- **One lookup:** `tokenize(code, language)` returns tokens, or `null` for a language nothing here highlights; `tokenizerFor(language)`, `resolveSyntaxLanguage(language)` and the `SYNTAX_LANGUAGES` list. Aliases are case-insensitive and ignore a leading dot (`"ts"`, `"bash"`, `".env"`, `"JSON"`). `normalizeTokens(code, tokens)` clamps and de-overlaps any token list; `tokenize` applies it.
- **New token kinds reuse existing palette slots**, so `TokenType` and `ThemeColors` are unchanged and custom themes keep working: shell flags and dotenv keys are `attribute`, command words `function`, `$VAR` / assignment names `variable`.

### Changed

- **`languageFromFilename` now recognises shell and dotenv files:** `.sh` / `.bash` / `.zsh` / `.ksh` and shell rc files (`.bashrc`, `.zshrc`, ...) return `"shell"`; `.env`, `.env.*` and `*.env` return `"dotenv"`. **`.env` previously returned `"plaintext"`.** If you branch on the returned id, `"shell"` and `"dotenv"` are new values; an editor that does not know them should treat them as plain text, which is what it got before. Every id `languageFromFilename` / `EXT_LANGUAGE` can return now has a tokenizer here, and a test enforces it.

### Fixed

- **`highlightCode` no longer duplicates text when tokens overlap.** A token that starts before the previous one ended is trimmed to the part not yet rendered, and nothing past the end of the source is emitted. Reachable today: PHP with an unterminated `<!--` before a `<?php` tag (`<!-- x <?php echo 1; ?>`) rendered `<?p` twice. Output for well-formed tokens is byte-identical.

- **`CHANGELOG.md` is now in the published tarball.** `files` did not whitelist it, so npm never shipped it — and this package puts breaking changes in MINOR releases and tells you in the README to read the entry before taking one. The instruction existed for the author, who has the file, and not for the consumer, who is the only one being instructed. Nothing for you to do; the file simply arrives from this release on.

## 0.3.0 — 2026-08-07

### Changed

- **BREAKING — Node 22 is now declared as the floor.** `engines.node` is `>=22`, where this package previously declared **nothing at all**.

  Declaring nothing was not the same as supporting old Node: a consumer on 18 installed cleanly and found out at runtime.

  **What you must do:** on Node 22 or newer, nothing. Note npm only *warns* on an `engines` mismatch while **pnpm fails the install**, so this surfaces differently depending on your package manager. Node 18 is end-of-life and 20 is maintenance-only.

### Why

These are the kit 0.5 platform floors, applied across every package at once so a consumer never has to resolve a mix. **No API changed, nothing was removed, nothing was renamed** — only what the package requires.


## 0.2.0 — 2026-07-14

### Added

- **syntax:** add pure highlight primitives (tokenizer, highlightCode, HTML grammar, palettes)

## 0.1.1 — 2026-07-04

### Fixed

- security sweep — linear cleanPath + patched esbuild (v0.1.1)

## 0.1.0 — 2026-07-04

### Added

- fancy-file-commons — shared pure core for the Fancy file packages
