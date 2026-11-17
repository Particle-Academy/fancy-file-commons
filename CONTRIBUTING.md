# Contributing to @particle-academy/fancy-file-commons

Notes for anyone, human or agent, working ON this package's code. How to USE the
package is in [AGENTS.md](./AGENTS.md); what it is, is in [README.md](./README.md).
`CLAUDE.md` is a symlink to this file, so Claude Code reads these notes when it
works in this repo.

## Layout

- `src/diff/` — diff engine, unified-diff parser, merge resolution, line annotations.
- `src/path.ts`, `src/language.ts` — filename helpers and filename-to-language map.
- `src/syntax/` — tokenizers, palettes and highlighting.
- `test/` — tests (`*.test.ts`), run with Node's test runner via `tsx`.

Anything two file packages would otherwise both implement lives here, once; new
shared file functionality lands here first, then the surface packages
(fancy-diff, fancy-code, react-fancy) consume it. Zero dependencies, no React,
no DOM.

## Commands

```bash
npm install
npm test       # node --import tsx --test test/*.test.ts
npm run build  # tsup -> dist (ESM + CJS + types)
npm run lint   # tsc --noEmit
```

## Changelog

Update `CHANGELOG.md` in the same commit as the change.
