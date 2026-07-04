/**
 * Path + filename helpers shared by the file surfaces — editors resolving a
 * language, viewers picking a renderer, writers naming their artifacts. Pure
 * string logic: no fs, no URL parsing beyond stripping query/hash.
 */

/** Last path segment of a filename/path/URL, ignoring any query string or hash. */
export function basename(path: string): string {
  return path.split(/[?#]/, 1)[0].split(/[\\/]/).pop() ?? "";
}

/**
 * Lowercased extension of a filename/path/URL, without the dot — `""` when
 * there is none. Dotfiles (`.gitignore`) and trailing dots have no extension.
 */
export function extname(path: string): string {
  const seg = basename(path);
  const dot = seg.lastIndexOf(".");
  if (dot <= 0 || dot === seg.length - 1) return "";
  return seg.slice(dot + 1).toLowerCase();
}

/** Basename without its extension (`report.final.xlsx` -> `report.final`). */
export function stem(path: string): string {
  const seg = basename(path);
  const ext = extname(path);
  return ext ? seg.slice(0, seg.length - ext.length - 1) : seg;
}
