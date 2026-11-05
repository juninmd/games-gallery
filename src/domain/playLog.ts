import { DAY_MS, dayOf } from "./day";
import { groupGames, totalHours } from "./duplicates";
import { fold } from "./scan/fold";
import type { Game } from "./types";

/**
 * Hours the app saw grow between two states of the library (a store sync, a manual edit). Stores report
 * totals, not sessions, so this is "when the total moved", day by day: honest, and only from first run on.
 */
export interface PlayEntry {
  /** Days since the Unix epoch (UTC). */
  d: number;
  title: string;
  /** Hours added that day. */
  h: number;
}

export const MAX_LOG = 5000;
const MAX_HOURS_PER_ENTRY = 100_000;
export { dayOf };

export interface Delta {
  title: string;
  hours: number;
}

/**
 * Compares playtime per game id with the last snapshot. New ids only set a baseline; decreases are corrections, not play.
 * The baseline is a high-water mark: typing "125" over "120" passes through 1 and 12, and a restored backup can carry
 * lower totals, so neither may lower it or the climb back would be logged as play.
 */
export function diffPlaytime(prev: Map<string, number>, games: Game[]): { deltas: Delta[]; next: Map<string, number> } {
  const next = new Map<string, number>();
  const deltas: Delta[] = [];
  for (const g of games) {
    const before = prev.get(g.id);
    next.set(g.id, Math.max(before ?? g.playtimeH, g.playtimeH));
    if (before === undefined) continue;
    const grew = Math.round((g.playtimeH - before) * 100) / 100;
    if (grew > 0 && grew <= MAX_HOURS_PER_ENTRY) deltas.push({ title: g.title, hours: grew });
  }
  return { deltas, next };
}

/** Adds deltas to a day, merging copies of the same title (any store) and keeping the log bounded. */
export function addEntries(log: PlayEntry[], deltas: Delta[], day: number): PlayEntry[] {
  if (!deltas.length) return log;
  const out = log.slice();
  for (const dl of deltas) {
    const key = fold(dl.title);
    if (!key) continue;
    const i = out.findIndex((e) => e.d === day && fold(e.title) === key);
    if (i >= 0) out[i] = { ...out[i]!, h: Math.round((out[i]!.h + dl.hours) * 100) / 100 };
    else out.push({ d: day, title: dl.title.slice(0, 200), h: dl.hours });
  }
  return out.length > MAX_LOG ? out.slice(out.length - MAX_LOG) : out;
}

export function sanitizeLog(raw: unknown): PlayEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PlayEntry[] = [];
  for (const e of raw) {
    if (typeof e !== "object" || e === null) continue;
    const { d, title, h } = e as Record<string, unknown>;
    if (typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 3_000_000) continue;
    if (typeof title !== "string" || !title || title.length > 200) continue;
    if (typeof h !== "number" || !Number.isFinite(h) || h <= 0 || h > MAX_HOURS_PER_ENTRY) continue;
    out.push({ d, title, h });
  }
  return out.slice(-MAX_LOG);
}

export interface Wrapped {
  year: number;
  logged: {
    hours: number;
    activeDays: number;
    longestStreak: number;
    /** 0-11, undefined when nothing was logged that year. */
    busiestMonth?: number;
    top: { title: string; hours: number }[];
  };
  library: {
    owned: number;
    completed: number;
    hours: number;
    topGenres: { genre: string; hours: number }[];
    topStores: { providerId: string; hours: number }[];
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function longestStreak(days: number[]): number {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  let best = 0, run = 0, prev = Number.NaN;
  for (const d of sorted) {
    run = d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function buildWrapped(log: PlayEntry[], games: Game[], year: number): Wrapped {
  const inYear = log.filter((e) => new Date(e.d * DAY_MS).getUTCFullYear() === year);
  const byTitle = new Map<string, { title: string; hours: number }>();
  const byMonth = new Array<number>(12).fill(0);
  for (const e of inYear) {
    const k = fold(e.title);
    const cur = byTitle.get(k);
    if (cur) cur.hours += e.h; else byTitle.set(k, { title: e.title, hours: e.h });
    byMonth[new Date(e.d * DAY_MS).getUTCMonth()]! += e.h;
  }
  const monthMax = Math.max(...byMonth);

  const groups = groupGames(games).filter((x) => x.primary.owned);
  const genre = new Map<string, number>();
  const store = new Map<string, number>();
  let hours = 0;
  for (const x of groups) {
    const h = totalHours(x.members);
    hours += h;
    for (const gname of x.primary.genres) genre.set(gname, (genre.get(gname) ?? 0) + h);
    for (const m of x.members) store.set(m.providerId, (store.get(m.providerId) ?? 0) + m.playtimeH);
  }
  const top = <K extends string>(m: Map<string, number>, key: K, n: number) =>
    [...m.entries()].filter(([, h]) => h > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k, h]) => ({ [key]: k, hours: round1(h) }) as Record<K, string> & { hours: number });

  return {
    year,
    logged: {
      hours: round1(inYear.reduce((s, e) => s + e.h, 0)),
      activeDays: new Set(inYear.map((e) => e.d)).size,
      longestStreak: longestStreak(inYear.map((e) => e.d)),
      busiestMonth: monthMax > 0 ? byMonth.indexOf(monthMax) : undefined,
      top: [...byTitle.values()].sort((a, b) => b.hours - a.hours || a.title.localeCompare(b.title)).slice(0, 5).map((t) => ({ title: t.title, hours: round1(t.hours) })),
    },
    library: {
      owned: groups.length,
      completed: groups.filter((x) => x.primary.status === "completed").length,
      hours: round1(hours),
      topGenres: top(genre, "genre", 5),
      topStores: top(store, "providerId", 5),
    },
  };
}
