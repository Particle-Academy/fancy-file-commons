import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenizeShell, type Token } from "../src/syntax";

const pairs = (src: string, tokens: Token[]) =>
  tokens.map((t) => [t.type, src.slice(t.start, t.end)] as const);
const has = (src: string, type: string, text: string) =>
  pairs(src, tokenizeShell(src)).some(([ty, tx]) => ty === type && tx === text);
const typeOf = (src: string, text: string) =>
  pairs(src, tokenizeShell(src)).find(([, tx]) => tx === text)?.[0];

test("a comment runs to the end of the line", () => {
  const src = "# install deps\nnpm ci";
  assert.ok(has(src, "comment", "# install deps"));
  assert.ok(has(src, "function", "npm"));
});

test("a # inside a word is not a comment", () => {
  const src = "echo a#b";
  assert.equal(pairs(src, tokenizeShell(src)).some(([ty]) => ty === "comment"), false);
});

test("the leading command word is a function; later words are not", () => {
  const src = "git commit -m msg";
  assert.equal(typeOf(src, "git"), "function");
  assert.notEqual(typeOf(src, "commit"), "function");
});

test("short and long flags are attributes", () => {
  const src = "ls -la --color=auto";
  assert.ok(has(src, "attribute", "-la"));
  assert.ok(has(src, "attribute", "--color=auto"));
});

test("single-quoted strings are literal: no variables inside", () => {
  const src = "echo '$HOME is literal'";
  assert.ok(has(src, "string", "'$HOME is literal'"));
  assert.equal(pairs(src, tokenizeShell(src)).some(([ty]) => ty === "variable"), false);
});

test("double-quoted strings highlight $VAR and ${VAR} inside", () => {
  const src = 'echo "hi $USER, home ${HOME}!"';
  assert.ok(has(src, "variable", "$USER"));
  assert.ok(has(src, "variable", "${HOME}"));
  assert.ok(has(src, "string", '"hi '));
  assert.ok(has(src, "string", '!"'));
});

test("an escaped quote does not end a double-quoted string", () => {
  const src = 'echo "a \\" b" done';
  assert.ok(has(src, "string", '"a \\" b"'));
});

test("bare variables, special parameters and assignments", () => {
  const src = "FOO=bar echo $1 $? $@ ${PATH:-/bin}";
  assert.ok(has(src, "variable", "FOO"));
  assert.ok(has(src, "operator", "="));
  assert.ok(has(src, "function", "echo"));
  assert.ok(has(src, "variable", "$1"));
  assert.ok(has(src, "variable", "$?"));
  assert.ok(has(src, "variable", "$@"));
  assert.ok(has(src, "variable", "${PATH:-/bin}"));
});

test("operators, and the word after one is a command again", () => {
  const src = "make build && npm test || exit 1; cat a | grep b > out >> log";
  for (const op of ["&&", "||", ";", "|", ">", ">>"]) assert.ok(has(src, "operator", op), op);
  for (const cmd of ["make", "npm", "exit", "cat", "grep"]) assert.equal(typeOf(src, cmd), "function", cmd);
});

test("a line continuation keeps the next line in the same command", () => {
  const src = "docker run \\\n  --rm image";
  assert.ok(has(src, "operator", "\\"));
  assert.ok(has(src, "attribute", "--rm"));
  assert.notEqual(typeOf(src, "image"), "function");
});

test("control keywords are keywords and keep command position", () => {
  const src = "if true; then echo ok; fi";
  assert.equal(typeOf(src, "if"), "keyword");
  assert.equal(typeOf(src, "then"), "keyword");
  assert.equal(typeOf(src, "fi"), "keyword");
  assert.equal(typeOf(src, "true"), "function");
  assert.equal(typeOf(src, "echo"), "function");
});

test("command substitution: $( starts a new command", () => {
  const src = "echo $(date +%s)";
  assert.equal(typeOf(src, "date"), "function");
});

test("CRLF line endings end comments and restart command position", () => {
  const src = "# c\r\nls -l\r\n";
  assert.ok(has(src, "comment", "# c"));
  assert.ok(has(src, "function", "ls"));
});

test("unterminated strings and ${ run to the end without throwing", () => {
  for (const src of ['echo "abc', "echo 'abc", "echo ${abc", "echo $", "echo \\", "\"$"]) {
    const tokens = tokenizeShell(src);
    for (const t of tokens) assert.ok(t.end <= src.length && t.start < t.end, src);
  }
});
