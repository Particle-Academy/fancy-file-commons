import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  tokenizeJavaScript,
  tokenizePhp,
  tokenizePython,
  tokenizeGo,
  tokenizeMarkdown,
  type Token,
} from "../src/syntax";

/** Substring covered by a token, for readable assertions. */
const span = (src: string, t: { start: number; end: number }) => src.slice(t.start, t.end);
/** `[type, text]` pairs, the easiest shape to assert against. */
const pairs = (src: string, tokens: Token[]) => tokens.map((t) => [t.type, span(src, t)]);
const has = (src: string, tokens: Token[], type: string, text: string) =>
  pairs(src, tokens).some(([ty, tx]) => ty === type && tx === text);

// Ported verbatim (vitest -> node:test) from fancy-code's
// src/engine/tokenizers/markdown.test.ts, which moved here with the tokenizer.
describe("tokenizeMarkdown", () => {
  test("marks a heading line as a keyword", () => {
    const src = "# Title";
    const tokens = tokenizeMarkdown(src);
    const heading = tokens.find((t) => t.type === "keyword");
    assert.equal(heading && span(src, heading), "# Title");
  });

  test("marks inline code as a string span", () => {
    const src = "use `x` here";
    const code = tokenizeMarkdown(src).find((t) => t.type === "string");
    assert.equal(code && span(src, code), "`x`");
  });

  test("marks emphasis as a type span and a list marker as an operator", () => {
    const src = "- **bold** item";
    const tokens = tokenizeMarkdown(src);
    assert.equal(span(src, tokens.find((t) => t.type === "operator")!), "-");
    assert.equal(span(src, tokens.find((t) => t.type === "type")!), "**bold**");
  });

  test("treats a fenced block body as string spans", () => {
    const src = "```\ncode line\n```";
    const strings = tokenizeMarkdown(src).filter((t) => t.type === "string");
    assert.equal(strings.length, 3); // opening fence, body, closing fence
  });

  test("produces ordered, non-overlapping inline spans", () => {
    const src = "`a` and **b** and `c`";
    const tokens = tokenizeMarkdown(src);
    for (let i = 1; i < tokens.length; i++) {
      assert.ok(tokens[i].start >= tokens[i - 1].start);
    }
  });
});

describe("tokenizeJavaScript", () => {
  test("keywords, functions, strings, numbers, comments", () => {
    const src = "const f = foo(1.5, 'a') // hi";
    const t = tokenizeJavaScript(src);
    assert.ok(has(src, t, "keyword", "const"));
    assert.ok(has(src, t, "function", "foo"));
    assert.ok(has(src, t, "number", "1.5"));
    assert.ok(has(src, t, "string", "'a'"));
    assert.ok(has(src, t, "comment", "// hi"));
  });

  test("TypeScript types and template literals", () => {
    const src = "let x: string = `t${y}`; class Foo {}";
    const t = tokenizeJavaScript(src);
    assert.ok(has(src, t, "type", "string"));
    assert.ok(has(src, t, "string", "`t${y}`"));
    assert.ok(has(src, t, "type", "Foo"));
  });

  test("JSON tokenizes sensibly: keys and values are strings, literals are coloured", () => {
    const src = '{"name": "fancy", "n": 12, "ok": true, "none": null, "list": [1, -2e3]}';
    const t = tokenizeJavaScript(src);
    assert.ok(has(src, t, "string", '"name"'));
    assert.ok(has(src, t, "string", '"fancy"'));
    assert.ok(has(src, t, "number", "12"));
    assert.ok(has(src, t, "keyword", "true"));
    assert.ok(has(src, t, "type", "null"));
    assert.ok(has(src, t, "number", "2e3"));
    assert.ok(has(src, t, "punctuation", "{"));
  });
});

describe("tokenizePhp", () => {
  test("PHP block: open tag, variables, keywords, strings", () => {
    const src = '<?php echo $name . "x"; ?>';
    const t = tokenizePhp(src);
    assert.ok(has(src, t, "keyword", "<?php"));
    assert.ok(has(src, t, "keyword", "echo"));
    assert.ok(has(src, t, "variable", "$name"));
    assert.ok(has(src, t, "string", '"x"'));
    assert.ok(has(src, t, "keyword", "?>"));
  });

  test("HTML around a PHP block is tokenized as HTML", () => {
    const src = "<b><?= $x ?></b>";
    const t = tokenizePhp(src);
    assert.ok(has(src, t, "tag", "b"));
    assert.ok(has(src, t, "keyword", "<?="));
  });
});

describe("tokenizePython", () => {
  test("def, decorators, strings, comments", () => {
    const src = "@app.route\ndef f(x: int) -> None:\n    return 'y'  # c";
    const t = tokenizePython(src);
    assert.ok(has(src, t, "keyword", "@app.route"));
    assert.ok(has(src, t, "keyword", "def"));
    assert.ok(has(src, t, "type", "int"));
    assert.ok(has(src, t, "string", "'y'"));
    assert.ok(has(src, t, "comment", "# c"));
  });
});

describe("tokenizeGo", () => {
  test("func, types, builtins, strings", () => {
    const src = 'func main() { s := make([]string, 0); fmt.Println("hi") }';
    const t = tokenizeGo(src);
    assert.ok(has(src, t, "keyword", "func"));
    assert.ok(has(src, t, "type", "string"));
    assert.ok(has(src, t, "string", '"hi"'));
  });
});
