// ---------------------------------------------------------------------------
// @particle-academy/fancy-file-commons — public surface
//
// The shared, pure, zero-dependency core for ALL of the Fancy file-focused
// packages — the editors (fancy-code), viewers (FileViewer), writers
// (holy-sheet / dark-slide JS), and diff surfaces (fancy-diff). Anything two
// file packages would otherwise both implement lives here once: today that's
// the diff module (engine + model + unified parser + merge + gutter
// annotations), path/filename helpers, and filename→language resolution.
// No React, no DOM — plain data in, plain data out.
// ---------------------------------------------------------------------------

// Path + filename helpers.
export { basename, extname, stem } from "./path";

// Filename → editor language resolution.
export { languageFromFilename, EXT_LANGUAGE } from "./language";

// Diff engine (pure, zero-dep).
export { computeDiff, buildDiff, splitLines, hunkId } from "./diff/engine";
export type { ComputeDiffOptions } from "./diff/engine";
export { diffSequences } from "./diff/lcs";
export type { EditOp } from "./diff/lcs";
export { diffLineSegments, defaultWordTokenizer } from "./diff/segments";
export { hash32 } from "./diff/hash";

// Unified-diff datasource.
export { parseUnifiedDiff } from "./diff/unified";
export type { ParseUnifiedOptions } from "./diff/unified";

// Source resolution (the discriminated union).
export {
  resolveSource,
  isDocumentsSource,
  isUnifiedSource,
  isPrebuiltSource,
} from "./diff/source";
export type {
  DiffSource,
  DocumentsSource,
  UnifiedSource,
  PrebuiltSource,
  ResolveSourceOptions,
} from "./diff/source";

// Merge resolution.
export { mergeResult, mergeLines, setAllStatus } from "./diff/merge";
export type { MergeOptions } from "./diff/merge";

// Per-line gutter annotations (editor gutters, diff rails, minimaps).
export { diffAnnotations, annotateLines } from "./diff/annotations";
export type { DiffAnnotations, LineAnnotation, LineChangeType } from "./diff/annotations";

// Structured model types.
export type {
  Diff,
  DiffFileMeta,
  Hunk,
  HunkType,
  DiffLine,
  LineSide,
  LineRange,
  DiffSegment,
  SegmentOp,
  SegmentPair,
  AcceptanceState,
  AcceptanceStatus,
  WordTokenizer,
} from "./diff/types";
export { fileLabel } from "./diff/types";
