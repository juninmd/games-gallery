import { PROVIDER_BY_ID } from "./providers";
import type { Game, PlayStatus } from "./types";

export type SortKey = "title" | "year" | "playtime" | "rating";

export interface GameFilter {
  query: string;
  providerIds: string[];
  platformId: string | null;
  status: PlayStatus | null;
  installedOnly: boolean;
  ownedOnly: boolean;
  /** Library views only: keep games that were unified from more than one store. */
  multiStoreOnly: boolean;
  sort: SortKey;
}

export const EMPTY_FILTER: GameFilter = {
  query: "",
  providerIds: [],
  platformId: null,
  status: null,
  installedOnly: false,
  ownedOnly: false,
  multiStoreOnly: false,
  sort: "title",
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Compile a shared title and genre matcher once per query. */
export function createGameQueryMatcher(query: string): (game: Game) => boolean {
  const q = fold(query.trim());
  // From three letters on, a query that starts a store name also finds that store's games ("epic", "gog").
  const byStore = q.length >= 3;
  return (game) =>
    !q ||
    fold(game.title).includes(q) ||
    game.genres.some((genre) => fold(genre).includes(q)) ||
    (byStore && fold(PROVIDER_BY_ID[game.providerId]?.name ?? "").startsWith(q));
}

const SORTERS: Record<SortKey, (a: Game, b: Game) => number> = {
  title: (a, b) => a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
  year: (a, b) => b.year - a.year,
  playtime: (a, b) => b.playtimeH - a.playtimeH,
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
};

/** One predicate per filter, compiled once; shared by the flat and the grouped library views. */
export function gameMatcher(f: GameFilter): (g: Game) => boolean {
  const matchesQuery = createGameQueryMatcher(f.query);
  return (g) => {
    if (!matchesQuery(g)) return false;
    if (f.providerIds.length && !f.providerIds.includes(g.providerId)) return false;
    if (f.platformId && g.platformId !== f.platformId) return false;
    if (f.status && g.status !== f.status) return false;
    if (f.installedOnly && !g.installed) return false;
    if (f.ownedOnly && !g.owned) return false;
    return true;
  };
}

export const compareGames = (sort: SortKey) => SORTERS[sort];

export function filterGames(games: Game[], f: GameFilter): Game[] {
  return games.filter(gameMatcher(f)).sort(SORTERS[f.sort]);
}

export interface LibraryStats {
  total: number;
  owned: number;
  installed: number;
  backlog: number;
  hours: number;
}

export function libraryStats(games: Game[]): LibraryStats {
  return {
    total: games.length,
    owned: games.filter((g) => g.owned).length,
    installed: games.filter((g) => g.installed).length,
    backlog: games.filter((g) => g.owned && g.status === "backlog").length,
    hours: Math.round(games.reduce((s, g) => s + g.playtimeH, 0)),
  };
}
