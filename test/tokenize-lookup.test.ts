import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokenize,
  tokenizerFor,
  resolveSyntaxLanguage,
  SYNTAX_LANGUAGES,
  tokenizeHtml,
  tokenizeJavaScript,
  tokenizeShell,
  tokenizeDotenv,
} from "../src/syntax";
import { EXT_LANGUAGE, languageFromFilename } from "../src/language";

test("aliases resolve to canonical language ids, case- and dot-insensitively", () => {
  const cases: Record<string, string> = {
    js: "javascript", jsx: "javascript", mjs: "javascript", json: "javascript", jsonc: "javascript",
    ts: "typescript", tsx: "typescript", TypeScript: "typescript",
    html: "html", htm: "html", xml: "html", xhtml: "html",
    php: "php", py: "python", python: "python", go: "go", golang: "go",
    md: "markdown", markdown: "markdown",
    sh: "shell", bash: "shell", zsh: "shell", shell: "shell", ".sh": "shell",
    env: "dotenv", ".env": "dotenv", dotenv: "dotenv",
  };
  for (const [alias, id] of Object.entries(cases)) {
    assert.equal(resolveSyntaxLanguage(alias), id, alias);
  }
});

test("unknown languages resolve to null and tokenize to null", () => {
  for (const lang of ["plaintext", "text", "", "cobol", "constructor", "__proto__", "toString"]) {
    assert.equal(resolveSyntaxLanguage(lang), null, lang);
    assert.equal(tokenizerFor(lang), null, lang);
    assert.equal(tokenize("x", lang), null, lang);
  }
});

test("tokenizerFor returns the real grammar", () => {
  assert.equal(tokenizerFor("html"), tokenizeHtml);
  assert.equal(tokenizerFor("ts"), tokenizeJavaScript);
  assert.equal(tokenizerFor("json"), tokenizeJavaScript);
  assert.equal(tokenizerFor("bash"), tokenizeShell);
  assert.equal(tokenizerFor(".env"), tokenizeDotenv);
});

test("tokenize returns tokens for a known language", () => {
  const tokens = tokenize("echo hi", "sh");
  assert.ok(tokens && tokens.length > 0);
});

test("SYNTAX_LANGUAGES lists every canonical id, each with a tokenizer", () => {
  for (const id of SYNTAX_LANGUAGES) assert.ok(tokenizerFor(id), id);
  assert.deepEqual(
    [...SYNTAX_LANGUAGES].sort(),
    ["dotenv", "go", "html", "javascript", "markdown", "php", "python", "shell", "typescript"],
  );
});

test("every language EXT_LANGUAGE names has a tokenizer that exists", () => {
  for (const [ext, lang] of Object.entries(EXT_LANGUAGE)) {
    assert.ok(tokenizerFor(lang), `${ext} -> ${lang} has no tokenizer`);
  }
});

test("languageFromFilename covers shell scripts and dotenv files", () => {
  assert.equal(languageFromFilename("deploy.sh"), "shell");
  assert.equal(languageFromFilename("install.bash"), "shell");
  assert.equal(languageFromFilename("prompt.zsh"), "shell");
  assert.equal(languageFromFilename(".env"), "dotenv");
  assert.equal(languageFromFilename("app/.env.local"), "dotenv");
  assert.equal(languageFromFilename(".env.example"), "dotenv");
  assert.equal(languageFromFilename("prod.env"), "dotenv");
  assert.equal(languageFromFilename(".bashrc"), "shell");
  assert.equal(languageFromFilename(".zshrc"), "shell");
  // Other dotfiles stay plaintext.
  assert.equal(languageFromFilename(".gitignore"), "plaintext");
  assert.equal(languageFromFilename(".environment"), "plaintext");
});
