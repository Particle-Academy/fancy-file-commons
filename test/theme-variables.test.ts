// Dual-palette highlighting for server rendering. `highlightCodeWithVariables`
// emits no colour value at all: each token span reads a CSS custom property
// (`var(--fc-<key>,var(--fc-<key>-l))`). The surface root declares both
// palettes with `themeVariables(light, dark)` and switches `--fc-<key>` to the
// dark value with CSS, so the server never needs to know the theme.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  highlightCode,
  highlightCodeWithVariables,
  themeVariables,
  themeColorVar,
  safeCssColor,
  THEME_COLOR_KEYS,
  tokenize,
  tokenizeHtml,
  LIGHT_COLORS,
  DARK_COLORS,
  type ThemeColors,
} from "../src/syntax";

const unrender = (html: string) =>
  html
    .replace(/<span style="[^"]*">|<\/span>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const HEX = /#[0-9a-fA-F]{3,8}/;

test("highlightCodeWithVariables emits var() references and no colour values", () => {
  const src = '<a href="x">hi</a> <!-- c -->';
  const html = highlightCodeWithVariables(src, tokenizeHtml(src));
  assert.ok(html.includes('style="color:var(--fc-tag,var(--fc-tag-l))"'), html);
  assert.ok(html.includes("var(--fc-attribute,var(--fc-attribute-l))"), html);
  assert.ok(html.includes("var(--fc-attributeValue,var(--fc-attributeValue-l))"), html);
  assert.ok(html.includes("color:var(--fc-comment,var(--fc-comment-l));font-style:italic"), html);
  assert.ok(!HEX.test(html), "no literal colour in the token HTML");
  assert.equal(unrender(html), src);
});

test("plain tokens read the foreground variable", () => {
  const src = "x";
  const html = highlightCodeWithVariables(src, [{ type: "plain", start: 0, end: 1 }]);
  assert.equal(html, '<span style="color:var(--fc-foreground,var(--fc-foreground-l))">x</span>');
});

test("highlightCodeWithVariables escapes text and splits tokens exactly like highlightCode", () => {
  const src = "x = \"</script><script>alert(1)</script>\" & y";
  const tokens = tokenize(src, "js")!;
  const vars = highlightCodeWithVariables(src, tokens);
  assert.ok(!vars.includes("<script"));
  assert.equal(unrender(vars), src);
  // Same span boundaries as the inline-colour renderer.
  const shape = (h: string) => h.replace(/style="[^"]*"/g, "S");
  assert.equal(shape(vars), shape(highlightCode(src, tokens, LIGHT_COLORS)));
  // No tokens: plain escaped text, as before.
  assert.equal(highlightCodeWithVariables("<x>", []), "&lt;x&gt;");
});

// Golden captured from 0.4.0's highlightCode (fancy-code renders this path).
test("highlightCode's inline-colour output is unchanged (fancy-code's path)", () => {
  const src = "<b>x</b>";
  const p = LIGHT_COLORS.punctuation;
  const tag = LIGHT_COLORS.tag;
  const fg = LIGHT_COLORS.foreground;
  assert.equal(
    highlightCode(src, tokenizeHtml(src), LIGHT_COLORS),
    `<span style="color:${p}">&lt;</span><span style="color:${tag}">b</span><span style="color:${p}">&gt;</span>` +
      `<span style="color:${fg}">x</span><span style="color:${p}">&lt;</span><span style="color:${p}">/</span>` +
      `<span style="color:${tag}">b</span><span style="color:${p}">&gt;</span>`,
  );
});

test("themeVariables declares both palettes for every palette key", () => {
  const vars = themeVariables(LIGHT_COLORS, DARK_COLORS);
  for (const key of THEME_COLOR_KEYS) {
    assert.equal(vars[`--fc-${key}-l`], LIGHT_COLORS[key], key);
    assert.equal(vars[`--fc-${key}-d`], DARK_COLORS[key], key);
  }
  // Every ThemeColors field is covered, optional diff marks included.
  assert.deepEqual([...THEME_COLOR_KEYS].sort(), Object.keys(LIGHT_COLORS).sort());
});

test("themeColorVar names the resolved variable with the light fallback", () => {
  assert.equal(themeColorVar("keyword"), "var(--fc-keyword,var(--fc-keyword-l))");
  assert.equal(themeColorVar("background"), "var(--fc-background,var(--fc-background-l))");
});

test("themeVariables cannot be used to inject CSS through a theme colour", () => {
  const evil: ThemeColors = {
    ...DARK_COLORS,
    keyword: "red;background:url(https://example.com/x)",
    string: "red}body{display:none",
    comment: "expression(alert(1))",
    tag: 'red" onmouseover="alert(1)',
  };
  const vars = themeVariables(LIGHT_COLORS, evil);
  const all = Object.values(vars).join(" ");
  assert.ok(!all.includes("url("), all);
  assert.ok(!all.includes("display"), all);
  assert.ok(!all.includes("expression"), all);
  assert.ok(!all.includes('"'), all);
  assert.ok(!all.includes(";"), all);
  assert.equal(vars["--fc-keyword-d"], "inherit");
  assert.equal(vars["--fc-keyword-l"], LIGHT_COLORS.keyword, "the safe palette is untouched");
});

test("themeVariables skips optional palette keys a custom theme leaves out", () => {
  const { diffAdded: _a, diffModified: _m, diffRemoved: _r, ...bare } = LIGHT_COLORS;
  const vars = themeVariables(bare, bare);
  assert.ok(!("--fc-diffAdded-l" in vars));
  assert.equal(vars["--fc-keyword-l"], LIGHT_COLORS.keyword);
});

test("the package root exports the new API", async () => {
  const root = await import("../src/index");
  for (const name of [
    "highlightCodeWithVariables", "themeVariables", "themeColorVar", "safeCssColor",
    "THEME_COLOR_KEYS", "tokenizePhpSnippet",
  ]) {
    assert.ok(name in root, name);
  }
});

test("safeCssColor is the same allow-list highlightCode applies", () => {
  assert.equal(safeCssColor("#abc"), "#abc");
  assert.equal(safeCssColor(" rgb(1, 2, 3) "), "rgb(1, 2, 3)");
  assert.equal(safeCssColor("hsl(10 20% 30% / 0.5)"), "hsl(10 20% 30% / 0.5)");
  assert.equal(safeCssColor("rebeccapurple"), "rebeccapurple");
  assert.equal(safeCssColor("red;color:blue"), "inherit");
  assert.equal(safeCssColor("var(--x)"), "inherit");
  assert.equal(safeCssColor(undefined), "inherit");
});
