/**
 * Tiny deterministic string hash (FNV-1a, 32-bit) rendered base36.
 *
 * Used only to derive stable, collision-resistant-enough hunk ids from
 * content. NOT cryptographic. The point is determinism: the same inputs
 * always yield the same id, so agents and humans share stable handles and
 * there is zero reliance on `Math.random`.
 */
export function hash32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in int range.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}
