import { test } from "node:test";
import assert from "node:assert/strict";
import { basename, extname, stem } from "../src/path";
import { languageFromFilename, EXT_LANGUAGE } from "../src/language";

test("basename strips directories, backslashes, query, and hash", () => {
  assert.equal(basename("src/components/App.tsx"), "App.tsx");
  assert.equal(basename("C:\\repo\\file.php"), "file.php");
  assert.equal(basename("https://x.dev/a/b.png?v=2#top"), "b.png");
  assert.equal(basename("plain.md"), "plain.md");
  assert.equal(basename(""), "");
});

test("extname is lowercased, dotless, dotfile-aware", () => {
  assert.equal(extname("report.final.XLSX"), "xlsx");
  assert.equal(extname("archive.tar.gz"), "gz");
  assert.equal(extname(".gitignore"), "");
  assert.equal(extname("Makefile"), "");
  assert.equal(extname("weird."), "");
  assert.equal(extname("a/b/c.TS?x=1"), "ts");
});

test("stem drops the extension only", () => {
  assert.equal(stem("report.final.xlsx"), "report.final");
  assert.equal(stem(".gitignore"), ".gitignore");
  assert.equal(stem("src/App.tsx"), "App");
});

test("languageFromFilename maps known extensions", () => {
  assert.equal(languageFromFilename("app.tsx"), "typescript");
  assert.equal(languageFromFilename("src/index.mjs"), "javascript");
  assert.equal(languageFromFilename("index.PHP"), "php");
  assert.equal(languageFromFilename("notes.md"), "markdown");
  assert.equal(languageFromFilename("main.go"), "go");
});

test("languageFromFilename falls back to plaintext", () => {
  assert.equal(languageFromFilename(), "plaintext");
  assert.equal(languageFromFilename("Makefile"), "plaintext");
  assert.equal(languageFromFilename(".env"), "plaintext");
  assert.equal(languageFromFilename("photo.png"), "plaintext");
});

test("EXT_LANGUAGE keys are all lowercase (extname contract)", () => {
  for (const key of Object.keys(EXT_LANGUAGE)) {
    assert.equal(key, key.toLowerCase());
  }
});
