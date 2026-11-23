import type { Game } from "./types";

/** One row of a filter list: what it selects, how many games it holds and a cover to recognize it by. */
export interface Facet {
  id: string;
  label: string;
  count: number;
  /** Cover of the most played game in the facet. */
  thumb?: string;
}

/** Lists longer than this get a search box. */
export const FACET_SEARCH_MIN = 8;

/** Groups games by the keys each one has, biggest group first; `label` names a key. */
export function facetsBy(games: readonly Game[], keysOf: (g: Game) => readonly string[], label: (key: string) => string): Facet[] {
  const acc = new Map<string, { count: number; best?: Game }>();
  for (const g of games) {
    for (const key of new Set(keysOf(g))) {
      const row = acc.get(key) ?? { count: 0 };
      row.count += 1;
      if (g.coverUrl && (!row.best || g.playtimeH > row.best.playtimeH)) row.best = g;
      acc.set(key, row);
    }
  }
  return [...acc]
    .map(([id, { count, best }]) => ({ id, label: label(id), count, thumb: best?.coverUrl }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const matchFacets = (facets: readonly Facet[], query: string): Facet[] => {
  const q = fold(query.trim());
  return q ? facets.filter((f) => fold(f.label).includes(q)) : [...facets];
};
