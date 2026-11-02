// PHP documentation snippets usually omit the `<?php` open tag. A whole FILE is
// inline HTML until `<?php` (that is what PHP itself does), so `tokenizePhp`
// keeps those semantics; `tokenizePhpSnippet` and `tokenize(..., { snippet:
// true })` start in PHP mode when the code opens no PHP block before closing
// one. fancy-code's file surfaces never pass the option.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  tokenize,
  tokenizePhp,
  tokenizePhpSnippet,
  type Token,
} from "../src/syntax";

const span = (src: string, t: { start: number; end: number }) => src.slice(t.start, t.end);
const pairs = (src: string, tokens: Token[]) => tokens.map((t) => [t.type, span(src, t)]);
const has = (src: string, tokens: Token[], type: string, text: string) =>
  pairs(src, tokens).some(([ty, tx]) => ty === type && tx === text);

// The exact snippet Prism reported from ai.particle.academy.
const PRISM = 'use Prism\\Prism\\Facades\\Prism;\n$model = getenv("MODEL");';

describe("PHP snippets (no open tag)", () => {
  test("tokenize(..., { snippet: true }) highlights keyword, namespace, variable, call and string", () => {
    const t = tokenize(PRISM, "php", { snippet: true })!;
    assert.ok(has(PRISM, t, "keyword", "use"), "use is a keyword");
    assert.ok(has(PRISM, t, "type", "Prism"), "namespace segments are types");
    assert.ok(has(PRISM, t, "type", "Facades"), "namespace segments are types");
    assert.ok(has(PRISM, t, "punctuation", "\\"), "namespace separator");
    assert.ok(has(PRISM, t, "variable", "$model"), "$model is a variable");
    assert.ok(has(PRISM, t, "function", "getenv"), "getenv( is a call");
    assert.ok(has(PRISM, t, "string", '"MODEL"'), "string literal");
  });

  test("tokenizePhpSnippet is the same grammar, exported for direct use", () => {
    assert.deepEqual(tokenizePhpSnippet(PRISM), tokenize(PRISM, "php", { snippet: true }));
  });

  test("without the option, a snippet keeps FILE semantics (inline HTML until <?php)", () => {
    const t = tokenize(PRISM, "php")!;
    assert.ok(!has(PRISM, t, "keyword", "use"), "file mode: no PHP keywords before <?php");
    assert.ok(!has(PRISM, t, "variable", "$model"));
    // The direct tokenizer is unchanged too: fancy-code registers it as-is.
    assert.deepEqual(tokenizePhp(PRISM).map((x) => x.type).includes("keyword"), false);
  });

  test("a full file with <?php tokenizes identically with or without the option", () => {
    const files = [
      '<?php\n\nnamespace App;\n\nuse Foo\\Bar;\n\necho $x . "y";\n',
      '<html><body><?php echo $name; ?></body></html>',
      "<b><?= $x ?></b>",
      "<!-- head --><?php $a = 1; ?>\n<p>tail</p>",
    ];
    for (const src of files) {
      assert.deepEqual(
        tokenize(src, "php", { snippet: true }),
        tokenize(src, "php"),
        JSON.stringify(src),
      );
      assert.deepEqual(tokenizePhpSnippet(src), tokenizePhp(src), JSON.stringify(src));
    }
  });

  test("a snippet that closes PHP with ?> then continues as HTML", () => {
    const src = 'echo $title; ?>\n<div class="x">hi</div>';
    const t = tokenize(src, "php", { snippet: true })!;
    assert.ok(has(src, t, "keyword", "echo"), "PHP before ?>");
    assert.ok(has(src, t, "variable", "$title"));
    assert.ok(has(src, t, "keyword", "?>"), "close tag");
    assert.ok(has(src, t, "tag", "div"), "HTML after ?>");
    assert.ok(has(src, t, "attribute", "class"));
    assert.ok(has(src, t, "attributeValue", '"x"'));
    assert.ok(!has(src, t, "keyword", "class"), "HTML is not read as PHP");
  });

  test("a snippet that closes, emits HTML, then reopens PHP", () => {
    const src = '$x = 1; ?><p>a</p><?php echo $x;';
    const t = tokenize(src, "php", { snippet: true })!;
    assert.ok(has(src, t, "variable", "$x"));
    assert.ok(has(src, t, "keyword", "?>"));
    assert.ok(has(src, t, "tag", "p"));
    assert.ok(has(src, t, "keyword", "<?php"));
    assert.ok(has(src, t, "keyword", "echo"));
  });

  test("the option only affects PHP", () => {
    const src = "const x = 1; // hi";
    assert.deepEqual(tokenize(src, "ts", { snippet: true }), tokenize(src, "ts"));
    assert.deepEqual(tokenize("<b>x</b>", "html", { snippet: true }), tokenize("<b>x</b>", "html"));
    assert.equal(tokenize("x", "cobol", { snippet: true }), null);
  });
});
