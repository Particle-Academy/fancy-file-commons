// ---------------------------------------------------------------------------
// Syntax theme colors. `ThemeColors` is the full palette a code surface needs
// (chrome + gutter + per-token colors); the two exported constants are the
// shared light/dark defaults. Higher-level packages (fancy-code) wrap these
// into named, registrable `ThemeDefinition`s — commons just ships the data.
// ---------------------------------------------------------------------------

export interface ThemeColors {
  // Editor chrome
  background: string;
  foreground: string;
  gutterBackground: string;
  gutterForeground: string;
  gutterBorder: string;
  activeLineBackground: string;
  selectionBackground: string;
  cursorColor: string;
  // Diff gutter marks (optional — VS Code-convention fallbacks apply when
  // omitted: green added, blue modified, red deleted).
  diffAdded?: string;
  diffModified?: string;
  diffRemoved?: string;
  // Token colors
  keyword: string;
  string: string;
  comment: string;
  number: string;
  operator: string;
  function: string;
  type: string;
  tag: string;
  attribute: string;
  attributeValue: string;
  punctuation: string;
  variable: string;
}

/** Shared light-mode palette. */
export const LIGHT_COLORS: ThemeColors = {
  background: "#ffffff",
  foreground: "#1e1e2e",
  gutterBackground: "#f8fafc",
  gutterForeground: "#94a3b8",
  gutterBorder: "#e2e8f0",
  activeLineBackground: "#f8fafc",
  selectionBackground: "#dbeafe",
  cursorColor: "#3b82f6",
  diffAdded: "#1a7f37",
  diffModified: "#0969da",
  diffRemoved: "#cf222e",
  keyword: "#8b5cf6",
  string: "#059669",
  comment: "#94a3b8",
  number: "#d97706",
  operator: "#0891b2",
  function: "#2563eb",
  type: "#d97706",
  tag: "#dc2626",
  attribute: "#d97706",
  attributeValue: "#059669",
  punctuation: "#64748b",
  variable: "#1e1e2e",
};

/** Shared dark-mode palette. */
export const DARK_COLORS: ThemeColors = {
  background: "#18181b",
  foreground: "#e4e4e7",
  gutterBackground: "#18181b",
  gutterForeground: "#52525b",
  gutterBorder: "#27272a",
  activeLineBackground: "#27272a",
  selectionBackground: "#1e3a5f",
  cursorColor: "#60a5fa",
  diffAdded: "#3fb950",
  diffModified: "#4184e4",
  diffRemoved: "#f85149",
  keyword: "#c084fc",
  string: "#34d399",
  comment: "#71717a",
  number: "#fbbf24",
  operator: "#22d3ee",
  function: "#60a5fa",
  type: "#fbbf24",
  tag: "#f87171",
  attribute: "#fbbf24",
  attributeValue: "#34d399",
  punctuation: "#a1a1aa",
  variable: "#e4e4e7",
};
