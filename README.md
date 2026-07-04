# Fancy File Commons

`@particle-academy/fancy-file-commons` — the **shared pure core for all of the
Fancy file-focused packages**: the editors
([`fancy-code`](https://github.com/Particle-Academy/fancy-code)), the viewers
(`FileViewer` and friends), the writers
([`holy-sheet`](https://github.com/Particle-Academy/holy-sheet-js) /
[`dark-slide`](https://github.com/Particle-Academy/dark-slide-js)), and the
diff surfaces ([`fancy-diff`](https://github.com/Particle-Academy/fancy-diff)).

**The rule:** anything two file packages would otherwise both implement lives
here, once. When an editor needs to know what changed in a document, it uses
the same engine the diff viewer renders; when a viewer needs a language for
`app.tsx`, it asks the same map the editor uses.

**Zero dependencies. No React, no DOM.** Every model is JSON-friendly,
deterministic (content-derived ids, no randomness), and safe to hand across an
MCP bridge.

## Modules (v0.1)

### `diff` — structured diffing

- **Engine** — `computeDiff(before, after)` → a structured `Diff`: line-level
  LCS alignment, adjacent delete+insert runs collapsed into `replace` hunks,
  optional intra-line word `segments`.
- **Unified-diff parser** — `parseUnifiedDiff(text)` turns `git diff` output
  (multi-file) into the same `Diff` model, one per file (flagged `partial`).
- **Source resolution** — `resolveSource({ before, after } | { unified } | { diff })`.
- **Merge resolution** — `mergeResult(diff, acceptance)` folds per-hunk
  accept/reject decisions into the merged document.
- **Line annotations** — `annotateLines(before, after)` → per-line gutter marks
  for the after document: `added` / `modified` per line, `deletedAbove` /
  `deletedAtEnd` counts, and totals. What an editor gutter or diff rail renders.

### `path` — filename helpers

`basename` / `extname` / `stem` — pure string logic (query/hash-aware, dotfile-aware).

### `language` — filename → editor language

`languageFromFilename("app.tsx")` → `"typescript"`, backed by the suite-wide
`EXT_LANGUAGE` extension map. Unknown → `"plaintext"`.

## Install

```bash
npm install @particle-academy/fancy-file-commons
```

## Use

```ts
import {
  computeDiff,
  annotateLines,
  mergeResult,
  setAllStatus,
  languageFromFilename,
  extname,
} from "@particle-academy/fancy-file-commons";

// Structured diff
const diff = computeDiff("a\nb\nc", "a\nB\nc\nd");

// Editor-gutter model (cheap: skips intra-line segmentation)
const ann = annotateLines("a\nb\nc", "a\nB\nc\nd");
// -> { byLine: { 2: {type:"modified"}, 4: {type:"added"} }, deletedAtEnd: 0, added: 1, modified: 1, removed: 0 }

// Accept everything -> the merged result is the after doc
mergeResult(diff, setAllStatus(diff, "accepted")); // "a\nB\nc\nd"

languageFromFilename("src/App.tsx"); // "typescript"
extname("report.final.XLSX"); // "xlsx"
```

## Consumers

| Package | Uses |
|---|---|
| `@particle-academy/fancy-diff` | the whole diff module (re-exported), + the React review UI on top |
| `@particle-academy/fancy-code` | `annotateLines` for the CodeEditor diff gutter; `languageFromFilename` for FileViewer |

New shared file functionality (mime maps, file-tree models, artifact naming, …)
lands here first, then the surface packages consume it.

## Develop

```bash
npm install
npm test       # node:test over test/*.test.ts
npm run build  # tsup -> dist (ESM + CJS + types)
```

## License

MIT.
