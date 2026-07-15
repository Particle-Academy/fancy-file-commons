import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokenizeHtml,
  highlightCode,
  LIGHT_COLORS,
  DARK_COLORS,
} from "../src/syntax";

test("tokenizeHtml emits tag / attribute / value tokens", () => {
  const src = '<a href="x">hi</a>';
  const tokens = tokenizeHtml(src);
  const types = tokens.map((t) => t.type);
  assert.ok(types.includes("tag"), "has a tag token");
  assert.ok(types.includes("attribute"), "has an attribute token");
  assert.ok(types.includes("attributeValue"), "has an attribute value token");
  // Offsets index into the original source (no captured text).
  const tag = tokens.find((t) => t.type === "tag")!;
  assert.equal(src.slice(tag.start, tag.end), "a");
});

test("tokenizeHtml handles comments", () => {
  const tokens = tokenizeHtml("<!-- note --><b>x</b>");
  assert.equal(tokens[0].type, "comment");
});

test("highlightCode wraps tokens in styled spans and escapes text", () => {
  const src = "<b>a&b</b>";
  const html = highlightCode(src, tokenizeHtml(src), LIGHT_COLORS);
  assert.ok(html.includes("<span"), "wraps tokens in spans");
  assert.ok(html.includes("&amp;"), "escapes ampersands");
  assert.ok(!html.includes("a&b"), "raw ampersand is escaped");
});

test("highlightCode with no tokens returns escaped plaintext (markdown path)", () => {
  const html = highlightCode("# Title <x>", [], DARK_COLORS);
  assert.equal(html, "# Title &lt;x&gt;");
  assert.ok(!html.includes("<span"), "no spans for plaintext");
});

test("highlightCode rejects unsafe theme colors (CSS injection guard)", () => {
  const evil = { ...LIGHT_COLORS, tag: "red;} body{display:none" };
  const src = "<b>x</b>";
  const html = highlightCode(src, tokenizeHtml(src), evil);
  assert.ok(!html.includes("display:none"), "unsafe color is dropped");
  assert.ok(html.includes("color:inherit"), "falls back to inherit");
});

test("light and dark palettes expose distinct token colors", () => {
  assert.notEqual(LIGHT_COLORS.background, DARK_COLORS.background);
  assert.notEqual(LIGHT_COLORS.keyword, DARK_COLORS.keyword);
});
