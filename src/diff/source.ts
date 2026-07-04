/**
 * Source resolution — normalize the `<FancyDiff source>` discriminated union
 * into a concrete list of `Diff`s (one per file). JSON-friendly inputs only.
 */
import { computeDiff, type ComputeDiffOptions } from "./engine";
import { parseUnifiedDiff, type ParseUnifiedOptions } from "./unified";
import type { Diff, WordTokenizer } from "./types";

/** Diff two in-memory documents (the engine computes the diff in-house). */
export interface DocumentsSource {
  before: string | string[];
  after: string | string[];
  /** Optional label for the single produced file. */
  label?: string;
}

/** Parse a git unified diff string (one Diff per file; partial documents). */
export interface UnifiedSource {
  unified: string;
}

/** Use a pre-built structured diff (or list of them) directly. */
export interface PrebuiltSource {
  diff: Diff | Diff[];
}

/** JSON-friendly discriminated union accepted by `<FancyDiff>`. */
export type DiffSource = DocumentsSource | UnifiedSource | PrebuiltSource;

export interface ResolveSourceOptions extends ComputeDiffOptions, ParseUnifiedOptions {
  tokenizer?: WordTokenizer;
}

export function isDocumentsSource(s: DiffSource): s is DocumentsSource {
  return "before" in s && "after" in s;
}
export function isUnifiedSource(s: DiffSource): s is UnifiedSource {
  return "unified" in s;
}
export function isPrebuiltSource(s: DiffSource): s is PrebuiltSource {
  return "diff" in s;
}

/** Resolve any source into a flat list of Diffs (one per file). */
export function resolveSource(
  source: DiffSource,
  options: ResolveSourceOptions = {},
): Diff[] {
  if (isPrebuiltSource(source)) {
    return Array.isArray(source.diff) ? source.diff : [source.diff];
  }
  if (isUnifiedSource(source)) {
    return parseUnifiedDiff(source.unified, options);
  }
  // DocumentsSource
  const diff = computeDiff(source.before, source.after, options);
  if (source.label) diff.file = { newPath: source.label };
  return [diff];
}
