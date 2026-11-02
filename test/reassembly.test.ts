// Property: highlighting never loses or duplicates text, in any language, on
// any input. Three layers are checked:
//   1. raw tokenizer output rendered through `highlightCode` round-trips to the
//      exact input (what every existing consumer does today);
//   2. `tokenize(code, lang)` returns well-formed tokens — in bounds, non-empty,
//      sorted, non-overlapping — so gaps + tokens reassemble exactly;
//   3. the new grammars (shell, dotenv) are well-formed even raw.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokenize,
  tokenizerFor,
  highlightCode,
  SYNTAX_LANGUAGES,
  LIGHT_COLORS,
  tokenizeShell,
  tokenizeDotenv,
  type Token,
} from "../src/syntax";

const unrender = (html: string) =>
  html
    .replace(/<span style="[^"]*">|<\/span>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function assertWellFormed(src: string, tokens: Token[], label: string) {
  let pos = 0;
  let out = "";
  for (const t of tokens) {
    assert.ok(Number.isInteger(t.start) && Number.isInteger(t.end), `${label}: integer offsets`);
    assert.ok(t.start >= pos, `${label}: token ${t.start}-${t.end} overlaps or precedes ${pos}`);
    assert.ok(t.end > t.start, `${label}: empty token at ${t.start}`);
    assert.ok(t.end <= src.length, `${label}: token ends at ${t.end} past ${src.length}`);
    out += src.slice(pos, t.start) + src.slice(t.start, t.end);
    pos = t.end;
  }
  out += src.slice(pos);
  assert.equal(out, src, `${label}: reassembly`);
}

const NASTY: string[] = [
  "",
  " ",
  "\n",
  "\r\n",
  "\r\n\r\n\r\n",
  "\t\t",
  "'",
  '"',
  "`",
  "'''",
  '"""',
  "'unterminated",
  '"unterminated',
  "`unterminated",
  '"ends in backslash\\',
  "'ends in backslash\\",
  "\\",
  "/*",
  "/* never closed",
  "<!--",
  "<!-- never closed <?php echo 1; ?> after",
  "<?php",
  "<?php echo \"open",
  "<? ?> <?= ?>",
  "<a href=\"x",
  "<",
  "<<<<>>>>",
  "${",
  "${unterminated",
  "$",
  "$(",
  "$((1+2))",
  "KEY=",
  "=value",
  "export",
  "export =",
  "A=\"x\\\"",
  "# only a comment",
  "#",
  "```",
  "```\nopen fence",
  "**",
  "*a*b*c*d*",
  "[link](",
  "x = 1\r\ny = 'a\r\nz",
  "line1\rline2\rline3",
  "unicode: éè 中文 😀 \u{10FFFF} ​ ",
  "lone surrogate \ud800 and \udfff",
  "nul\u0000byte",
  "&amp; &lt;script&gt; <script>alert(1)</script>",
  "x".repeat(100_000),
  "\"".repeat(10_001),
  "'".repeat(10_001),
  "*a ".repeat(4000),
  "${".repeat(5000),
  "\\\n".repeat(3000),
  "a=b\n".repeat(5000),
  "-".repeat(20_000),
];

// Deterministic fuzz over an alphabet of characters every grammar cares about.
function* fuzz(seed: number, count: number): Generator<string> {
  const alphabet = [
    "a", "Z", "_", "0", "9", " ", "\t", "\n", "\r\n", "'", '"', "`", "\\", "$", "{", "}",
    "(", ")", "[", "]", "<", ">", "/", "*", "#", "-", "--", "=", "|", "&", ";", "!", "?",
    "<?php", "?>", "<!--", "-->", "/*", "*/", "${", "$(", "```", "export ", "é", "😀",
  ];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let n = 0; n < count; n++) {
    const len = Math.floor(rand() * 80);
    let str = "";
    for (let i = 0; i < len; i++) str += alphabet[Math.floor(rand() * alphabet.length)];
    yield str;
  }
}

const inputs = [...NASTY, ...fuzz(0xfa9c1, 400)];

for (const lang of SYNTAX_LANGUAGES) {
  test(`${lang}: raw tokens render back to the exact input`, () => {
    const tokenizer = tokenizerFor(lang)!;
    for (const src of inputs) {
      const raw = tokenizer(src);
      const html = highlightCode(src, raw, LIGHT_COLORS);
      assert.equal(unrender(html), src, `${lang} on ${JSON.stringify(src.slice(0, 60))}`);
    }
  });

  test(`${lang}: tokenize() output is well-formed and reassembles exactly`, () => {
    for (const src of inputs) {
      const tokens = tokenize(src, lang);
      assert.ok(tokens, lang);
      assertWellFormed(src, tokens, `${lang} on ${JSON.stringify(src.slice(0, 60))}`);
    }
  });
}

test("shell and dotenv are well-formed even before normalisation", () => {
  for (const src of inputs) {
    assertWellFormed(src, tokenizeShell(src), `shell raw on ${JSON.stringify(src.slice(0, 60))}`);
    assertWellFormed(src, tokenizeDotenv(src), `dotenv raw on ${JSON.stringify(src.slice(0, 60))}`);
  }
});

test("highlightCode never duplicates text from overlapping or overrunning tokens", () => {
  const src = "abcdef";
  const tokens: Token[] = [
    { type: "keyword", start: 0, end: 4 },
    { type: "string", start: 2, end: 5 }, // overlaps the previous token
    { type: "comment", start: 5, end: 99 }, // runs past the end
  ];
  assert.equal(unrender(highlightCode(src, tokens, LIGHT_COLORS)), src);
});

test("every language escapes a <script> payload", () => {
  const src = "x = \"</script><script>alert(1)</script>\" <img src=x onerror=alert(1)> & ' ` $";
  for (const lang of SYNTAX_LANGUAGES) {
    const html = highlightCode(src, tokenize(src, lang)!, LIGHT_COLORS);
    assert.ok(!html.includes("<script"), lang);
    assert.ok(!html.includes("<img"), lang);
    assert.equal(unrender(html), src, lang);
  }
});
