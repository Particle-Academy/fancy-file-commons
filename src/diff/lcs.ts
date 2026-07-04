/**
 * Line-level diff via Longest Common Subsequence (Hunt–McIlroy style).
 *
 * Pure, zero-dependency. Produces an ordered op list over two line arrays.
 * LCS gives a minimal, deterministic alignment that is more than adequate
 * for document diffing; we collapse adjacent delete+insert runs into
 * `replace` blocks at a higher layer.
 */

export type EditOp =
  | { op: "equal"; beforeIndex: number; afterIndex: number }
  | { op: "remove"; beforeIndex: number }
  | { op: "add"; afterIndex: number };

/**
 * Compute the LCS-based edit script between two token arrays.
 *
 * Uses the classic DP table. O(n*m) time/space — fine for documents up to a
 * few thousand lines, which is the target. For pathological inputs callers
 * can pre-chunk, but we keep the implementation simple and obviously correct.
 */
export function diffSequences(before: string[], after: string[]): EditOp[] {
  const n = before.length;
  const m = after.length;

  // dp[i][j] = LCS length of before[i..] and after[j..].
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        before[i] === after[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: EditOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ op: "equal", beforeIndex: i, afterIndex: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: "remove", beforeIndex: i });
      i++;
    } else {
      ops.push({ op: "add", afterIndex: j });
      j++;
    }
  }
  while (i < n) ops.push({ op: "remove", beforeIndex: i++ });
  while (j < m) ops.push({ op: "add", afterIndex: j++ });

  return ops;
}
