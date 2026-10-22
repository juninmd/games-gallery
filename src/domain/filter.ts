import type { Game, PlayStatus } from "./types";

export type SortKey = "title" | "year" | "playtime" | "rating";

export interface GameFilter {
  query: string;
  providerIds: string[];
  platformId: string | null;
  status: PlayStatus | null;
  installedOnly: boolean;
  ownedOnly: boolean;
  sort: SortKey;
}

export const EMPTY_FILTER: GameFilter = {
  query: "",
  providerIds: [],
  platformId: null,
  status: null,
  installedOnly: false,
  ownedOnly: false,
  sort: "title",
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const SORTERS: Record<SortKey, (a: Game, b: Game) => number> = {
  title: (a, b) => a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
  year: (a, b) => b.year - a.year,
  playtime: (a, b) => b.playtimeH - a.playtimeH,
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
};

export function filterGames(games: Game[], f: GameFilter): Game[] {
  const q = fold(f.query.trim());
  return games
    .filter((g) => {
      if (q && !fold(g.title).includes(q) && !g.genres.some((x) => fold(x).includes(q))) return false;
      if (f.providerIds.length && !f.providerIds.includes(g.providerId)) return false;
      if (f.platformId && g.platformId !== f.platformId) return false;
      if (f.status && g.status !== f.status) return false;
      if (f.installedOnly && !g.installed) return false;
      if (f.ownedOnly && !g.owned) return false;
      return true;
    })
    .sort(SORTERS[f.sort]);
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
