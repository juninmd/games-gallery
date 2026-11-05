/** While set, library changes are not read as play time (a backup restore replaces totals; it is not play). */
let depth = 0;

export const isQuiet = (): boolean => depth > 0;

export function quietly<T>(fn: () => T): T {
  depth++;
  try {
    return fn();
  } finally {
    depth--;
  }
}
