/**
 * Merge resolution — fold a `Diff` plus an acceptance map into a merged
 * document. Pure + deterministic.
 *
 * Semantics, per hunk type:
 *   - equal   : always kept (context, unchanged in both docs).
 *   - add     : accepted -> include the added lines; rejected/pending -> drop.
 *   - remove  : accepted -> drop the removed lines (accept the deletion);
 *               rejected/pending -> keep the original (before) lines.
 *   - replace : accepted -> use the after lines; rejected/pending -> keep
 *               the before lines.
 *
 * "pending" is treated like "rejected" for the *output* (the change is not
 * yet applied) so a partially-reviewed diff always yields a coherent doc
 * representing only the changes a human/agent has explicitly accepted.
 */
import type { AcceptanceState, AcceptanceStatus, Diff } from "./types";

export interface MergeOptions {
  /**
   * Status assumed for hunks missing from the acceptance map. Default
   * "pending" (so unreviewed changes are not yet applied).
   */
  defaultStatus?: AcceptanceStatus;
  /** Join lines with this separator. Default "\n". */
  newline?: string;
}

/** Resolve the merged lines from a diff + acceptance state. */
export function mergeLines(
  diff: Diff,
  acceptance: AcceptanceState,
  options: MergeOptions = {},
): string[] {
  const { defaultStatus = "pending" } = options;
  const out: string[] = [];

  for (const hunk of diff.hunks) {
    const status = acceptance[hunk.id] ?? defaultStatus;
    const accepted = status === "accepted";

    switch (hunk.type) {
      case "equal":
        for (const l of hunk.lines) out.push(l.text);
        break;

      case "add":
        if (accepted) {
          for (const l of hunk.lines) out.push(l.text);
        }
        break;

      case "remove":
        if (!accepted) {
          for (const l of hunk.lines) out.push(l.text);
        }
        break;

      case "replace":
        if (accepted) {
          for (const l of hunk.lines) if (l.side === "after") out.push(l.text);
        } else {
          for (const l of hunk.lines) if (l.side === "before") out.push(l.text);
        }
        break;
    }
  }

  return out;
}

/** Resolve the merged document string from a diff + acceptance state. */
export function mergeResult(
  diff: Diff,
  acceptance: AcceptanceState,
  options: MergeOptions = {},
): string {
  return mergeLines(diff, acceptance, options).join(options.newline ?? "\n");
}

/** Build an acceptance map setting every changed hunk to one status. */
export function setAllStatus(diff: Diff, status: AcceptanceStatus): AcceptanceState {
  const state: AcceptanceState = {};
  for (const hunk of diff.hunks) {
    if (hunk.type !== "equal") state[hunk.id] = status;
  }
  return state;
}
