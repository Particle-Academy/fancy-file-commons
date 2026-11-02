// Syntax-highlighting primitives (pure, framework-free).
export type { Token, TokenType, Tokenizer } from "./tokenizer";
export { tok } from "./tokenizer";

// Grammars. JavaScript also covers TypeScript and JSON.
export { tokenizeHtml } from "./html";
export { tokenizeJavaScript } from "./javascript";
export { tokenizePhp, tokenizePhpSnippet } from "./php";
export { tokenizePython } from "./python";
export { tokenizeGo } from "./go";
export { tokenizeMarkdown } from "./markdown";
export { tokenizeShell } from "./shell";
export { tokenizeDotenv } from "./dotenv";

// One lookup: language id or alias -> tokenizer / tokens, or null when unknown.
export type { SyntaxLanguage, TokenizeOptions } from "./lookup";
export { SYNTAX_LANGUAGES, resolveSyntaxLanguage, tokenizerFor, tokenize, normalizeTokens } from "./lookup";

export type { ThemeColorKey } from "./highlight";
export {
  highlightCode,
  highlightCodeWithVariables,
  themeVariables,
  themeColorVar,
  safeCssColor,
  THEME_COLOR_KEYS,
} from "./highlight";
export type { ThemeColors } from "./theme";
export { LIGHT_COLORS, DARK_COLORS } from "./theme";
