import type { Game, PlayStatus } from "./types";

export interface Bucket {
  id: string;
  games: number;
  hours: number;
}

export interface Stats {
  owned: number;
  wishlist: number;
  hours: number;
  /** completed / owned, 0 when nothing is owned. */
  completionRate: number;
  /** Mean of the user's 1-5 ratings; undefined when nothing is rated. */
  avgRating?: number;
  /** Owned backlog games never played (0 hours). */
  untouched: number;
  installedGb: number;
  byStatus: Record<PlayStatus, number>;
  ratings: [number, number, number, number, number];
  byPlatform: Bucket[];
  byProvider: Bucket[];
  mostPlayed: Game[];
}

const bucketBy = (games: Game[], key: (g: Game) => string): Bucket[] => {
  const m = new Map<string, Bucket>();
  for (const g of games) {
    const b = m.get(key(g)) ?? { id: key(g), games: 0, hours: 0 };
    b.games++;
    b.hours += g.playtimeH;
    m.set(b.id, b);
  }
  return [...m.values()].sort((a, b) => b.games - a.games || b.hours - a.hours || a.id.localeCompare(b.id));
};

export function computeStats(games: Game[], top = 8): Stats {
  const owned = games.filter((g) => g.owned);
  const rated = owned.filter((g) => g.rating);
  const byStatus: Record<PlayStatus, number> = { playing: 0, backlog: 0, completed: 0, dropped: 0, wishlist: 0 };
  for (const g of games) byStatus[g.status]++;
  const ratings: Stats["ratings"] = [0, 0, 0, 0, 0];
  for (const g of rated) ratings[Math.min(5, Math.max(1, Math.round(g.rating ?? 1))) - 1]!++;

  return {
    owned: owned.length,
    wishlist: games.length - owned.length,
    hours: Math.round(owned.reduce((s, g) => s + g.playtimeH, 0)),
    completionRate: owned.length ? byStatus.completed / owned.length : 0,
    avgRating: rated.length ? Math.round((rated.reduce((s, g) => s + (g.rating ?? 0), 0) / rated.length) * 10) / 10 : undefined,
    untouched: owned.filter((g) => g.status === "backlog" && g.playtimeH === 0).length,
    installedGb: Math.round(games.filter((g) => g.installed).reduce((s, g) => s + (g.sizeGb ?? 0), 0)),
    byStatus,
    ratings,
    byPlatform: bucketBy(owned, (g) => g.platformId),
    byProvider: bucketBy(owned, (g) => g.providerId),
    mostPlayed: [...owned].filter((g) => g.playtimeH > 0).sort((a, b) => b.playtimeH - a.playtimeH || a.title.localeCompare(b.title)).slice(0, top),
  };
}
