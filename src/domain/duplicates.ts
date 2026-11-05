import { compareGames, gameMatcher, type GameFilter } from "./filter";
import { fold } from "./scan/fold";
import { sanitizeTags } from "./tags";
import type { Game } from "./types";

/** One game as the user thinks of it: every store that owns it, with the best copy first. */
export interface GameGroup {
  primary: Game;
  /** All copies (stores) of the game, primary included; length > 1 means a duplicate was unified. */
  members: Game[];
}

/** Stores are PC-only; the same title on a console family or a ROM is a different release. */
export function duplicateKey(game: Game): string | null {
  if (game.platformId !== "pc" || game.separate) return null;
  const key = fold(game.title);
  return key ? key : null;
}

const rank = (g: Game) => (g.installed ? 4 : 0) + (g.owned ? 2 : 0);

/** Installed beats owned beats wishlisted; then more hours, then a stable id order. */
function comparePrimary(a: Game, b: Game): number {
  return rank(b) - rank(a) || b.playtimeH - a.playtimeH || a.id.localeCompare(b.id);
}

export const pickPrimary = (members: Game[]): Game => [...members].sort(comparePrimary)[0]!;

/**
 * A store copy added later does not carry what you set on the others, and the installed copy is the primary.
 * The primary therefore shows the union of tags, the earliest queue slot and the first estimate among the owned copies;
 * editing it writes the merged value back to every copy (see `applyShared`). Returns the same object when nothing differs.
 */
export function withShared(primary: Game, members: Game[]): Game {
  if (members.length < 2) return primary;
  const owned = members.filter((m) => m.owned);
  const tags = sanitizeTags([...(primary.tags ?? []), ...owned.flatMap((m) => m.tags ?? [])]);
  const slots = owned.flatMap((m) => (m.queuedAt === undefined ? [] : [m.queuedAt]));
  const queuedAt = slots.length ? Math.min(...slots) : undefined;
  const hoursToBeat = primary.hoursToBeat ?? owned.find((m) => m.hoursToBeat !== undefined)?.hoursToBeat;
  const same = JSON.stringify(tags) === JSON.stringify(primary.tags) && queuedAt === primary.queuedAt && hoursToBeat === primary.hoursToBeat;
  return same ? primary : { ...primary, tags, queuedAt, hoursToBeat };
}

/**
 * Groups the same PC title found in different stores. The same store twice (demo, re-import) stays
 * separate: only a second provider proves it is the same game owned elsewhere.
 */
export function groupGames(games: Game[]): GameGroup[] {
  const buckets = new Map<string, Game[]>();
  const order: Array<string | Game> = [];
  for (const game of games) {
    const key = duplicateKey(game);
    if (!key) {
      order.push(game);
      continue;
    }
    const bucket = buckets.get(key);
    if (bucket) bucket.push(game);
    else {
      buckets.set(key, [game]);
      order.push(key);
    }
  }
  return order.flatMap((entry): GameGroup[] => {
    if (typeof entry !== "string") return [{ primary: entry, members: [entry] }];
    const bucket = buckets.get(entry)!;
    if (new Set(bucket.map((g) => g.providerId)).size < 2) return bucket.map((g) => ({ primary: g, members: [g] }));
    return [{ primary: withShared(pickPrimary(bucket), bucket), members: [...bucket].sort(comparePrimary) }];
  });
}

/** The other stores that own this same game. */
export function siblingsOf(games: Game[], game: Game): Game[] {
  const group = groupGames(games).find((x) => x.members.some((m) => m.id === game.id));
  return group ? group.members.filter((m) => m.id !== game.id) : [];
}

export const totalHours = (members: Game[]) => members.reduce((sum, g) => sum + g.playtimeH, 0);
const hours = (x: GameGroup) => totalHours(x.members);

/**
 * Filters groups: one matching store keeps the whole game, the primary is picked among the stores that
 * match (so "installed only" shows the installed copy), and every store stays listed.
 */
export function filterGameGroups(games: Game[], f: GameFilter): GameGroup[] {
  const matches = gameMatcher(f);
  const compare = compareGames(f.sort);
  return groupGames(games)
    .filter((group) => !f.multiStoreOnly || group.members.length > 1)
    .flatMap((group): GameGroup[] => {
      const passing = group.members.filter(matches);
      return passing.length ? [{ primary: withShared(pickPrimary(passing), group.members), members: group.members }] : [];
    })
    .sort(f.sort === "playtime" ? (a, b) => hours(b) - hours(a) : (a, b) => compare(a.primary, b.primary));
}

export interface GroupStats {
  /** Distinct games, counting a title owned in three stores once. */
  total: number;
  owned: number;
  installed: number;
  backlog: number;
  hours: number;
  /** Games found in more than one store, and the copies that unification folded away. */
  duplicates: number;
  foldedCopies: number;
}

export function groupStats(groups: GameGroup[]): GroupStats {
  const dup = groups.filter((x) => x.members.length > 1);
  return {
    total: groups.length,
    owned: groups.filter((x) => x.members.some((m) => m.owned)).length,
    installed: groups.filter((x) => x.members.some((m) => m.installed)).length,
    backlog: groups.filter((x) => x.members.some((m) => m.owned) && x.primary.status === "backlog").length,
    hours: Math.round(groups.reduce((s, x) => s + hours(x), 0)),
    duplicates: dup.length,
    foldedCopies: dup.reduce((s, x) => s + x.members.length - 1, 0),
  };
}

const SHARED_FIELDS = ["status", "rating", "notes", "tags", "hoursToBeat", "queuedAt"] as const;

/**
 * Applies a patch to one game and spreads what is about *you and the game* (status, rating, notes, tags, time to beat, queue) to your
 * other owned copies, so "Zerado" on Steam is not "Quero jogar" on GOG. Ownership, installs, hours and
 * store ids stay per store, and a wishlist move never spreads (you may own it elsewhere).
 */
export function applyShared(games: Game[], id: string, patch: Partial<Game>): Game[] {
  const next = games.map((g) => (g.id === id ? { ...g, ...patch } : g));
  const target = games.find((g) => g.id === id);
  if (!target?.owned || patch.status === "wishlist") return next;
  const shared = Object.fromEntries(SHARED_FIELDS.filter((k) => k in patch).map((k) => [k, patch[k]]));
  if (!Object.keys(shared).length) return next;
  const group = groupGames(games).find((x) => x.members.some((m) => m.id === id));
  const peers = new Set((group?.members ?? []).filter((m) => m.owned && m.id !== id).map((m) => m.id));
  return peers.size ? next.map((g) => (peers.has(g.id) ? { ...g, ...shared } : g)) : next;
}

const byHours = (a: GameGroup, b: GameGroup) => hours(b) - hours(a) || a.primary.title.localeCompare(b.primary.title);

/** Games being played, once each, most hours (summed over stores) first. */
export const nowPlayingGroups = (groups: GameGroup[]): GameGroup[] => groups.filter((x) => x.primary.status === "playing").sort(byHours);

/** The spotlight: what you are playing, else the most played; art from any store counts. */
export function featuredGroup(groups: GameGroup[]): GameGroup | undefined {
  const art = (x: GameGroup) => x.members.some((m) => m.coverUrl);
  const withArt = groups.filter(art);
  const pool = withArt.length ? withArt : groups;
  const playing = pool.filter((x) => x.primary.status === "playing");
  return [...(playing.length ? playing : pool)].sort(byHours)[0];
}

/** Random owned backlog game, one chance per title however many stores own it. */
export function pickBacklog(groups: GameGroup[], random: () => number = Math.random): GameGroup | undefined {
  const pool = groups.filter((x) => x.primary.status === "backlog" && x.members.some((m) => m.owned));
  return pool[Math.floor(random() * pool.length)];
}
