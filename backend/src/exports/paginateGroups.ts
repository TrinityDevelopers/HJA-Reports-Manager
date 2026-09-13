/**
 * Pack whole groups onto pages of at most `maxEntries` rows.
 * `sizeOf` returns the row count for a group (excluding inter-group spacers).
 * A spacer row is counted between consecutive groups on the same page.
 * A single group larger than maxEntries still occupies its own page (overflow allowed).
 * No spacer is inserted at a page break.
 */
export function paginateGroupsBySize<T>(
  groups: T[],
  maxEntries: number,
  sizeOf: (group: T) => number,
): T[][] {
  const nonempty = groups.filter((group) => sizeOf(group) > 0);
  if (nonempty.length === 0) return [[]];

  const pages: T[][] = [];
  let current: T[] = [];
  let used = 0;

  for (const group of nonempty) {
    const sampleCount = sizeOf(group);
    const spacer = current.length > 0 ? 1 : 0;
    if (current.length > 0 && used + spacer + sampleCount > maxEntries) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(group);
    used += (current.length > 1 ? 1 : 0) + sampleCount;
  }

  if (current.length > 0) {
    pages.push(current);
  }

  return pages;
}
