import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenizeDotenv, type Token } from "../src/syntax";

const pairs = (src: string, tokens: Token[]) =>
  tokens.map((t) => [t.type, src.slice(t.start, t.end)] as const);
const has = (src: string, type: string, text: string) =>
  pairs(src, tokenizeDotenv(src)).some(([ty, tx]) => ty === type && tx === text);

test("comment lines", () => {
  const src = "# database\nDB_HOST=localhost";
  assert.ok(has(src, "comment", "# database"));
});

test("KEY = value: key is an attribute, = an operator, value a string", () => {
  const src = "APP_NAME=Fancy";
  assert.ok(has(src, "attribute", "APP_NAME"));
  assert.ok(has(src, "operator", "="));
  assert.ok(has(src, "string", "Fancy"));
});

test("the export prefix is a keyword", () => {
  const src = "export API_URL=https://example.com";
  assert.ok(has(src, "keyword", "export"));
  assert.ok(has(src, "attribute", "API_URL"));
  assert.ok(has(src, "string", "https://example.com"));
});

test("quoted values: double, single, and an inline comment after", () => {
  const src = 'A="hello world" # note\nB=\'raw ${X}\'';
  assert.ok(has(src, "string", '"hello world"'));
  assert.ok(has(src, "comment", "# note"));
  assert.ok(has(src, "string", "'raw ${X}'"));
});

test("an unquoted # without leading space is part of the value", () => {
  const src = "COLOR=#fff";
  assert.ok(has(src, "string", "#fff"));
});

test("${VAR} interpolation in double-quoted and unquoted values", () => {
  const src = 'URL="${HOST}:${PORT}"\nP=${HOME}/bin';
  assert.ok(has(src, "variable", "${HOST}"));
  assert.ok(has(src, "variable", "${PORT}"));
  assert.ok(has(src, "variable", "${HOME}"));
  assert.ok(has(src, "string", "/bin"));
});

test("a double-quoted value may span lines", () => {
  const src = 'KEY="line1\nline2"\nNEXT=1';
  assert.ok(has(src, "string", '"line1\nline2"'));
  assert.ok(has(src, "attribute", "NEXT"));
});

test("an unterminated quote stops at the end of its line", () => {
  const src = 'A="open\nB=2';
  assert.ok(has(src, "string", '"open'));
  assert.ok(has(src, "attribute", "B"));
});

test("CRLF line endings, empty values and lines without =", () => {
  const src = "A=1\r\nEMPTY=\r\njunk line\r\n";
  assert.ok(has(src, "attribute", "A"));
  assert.ok(has(src, "string", "1"));
  assert.ok(has(src, "attribute", "EMPTY"));
  assert.equal(pairs(src, tokenizeDotenv(src)).some(([, tx]) => tx.includes("\r")), false);
});
