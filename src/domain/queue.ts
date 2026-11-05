import type { GameGroup } from "./duplicates";
import { totalHours } from "./duplicates";
import { fold } from "./scan/fold";
import { tagKey } from "./tags";
import type { Game } from "./types";

const open = (g: Game) => g.owned && (g.status === "backlog" || g.status === "playing");

/** The play queue, oldest entry first; finished or dropped titles fall out on their own. */
export function queueOf(groups: GameGroup[]): GameGroup[] {
  return groups
    .filter((x) => x.primary.queuedAt !== undefined && open(x.primary))
    .sort((a, b) => a.primary.queuedAt! - b.primary.queuedAt! || a.primary.title.localeCompare(b.primary.title, "pt-BR"));
}

/** Slot for a new entry: always after the current last, even when the clock did not advance. */
export const nextSlot = (groups: GameGroup[], now = Date.now()): number =>
  Math.max(now, ...groups.map((x) => (x.primary.queuedAt ?? 0) + 1));

/**
 * Moves one entry `delta` places and renumbers the whole queue with consecutive slots, so equal or sparse
 * slots (an import, a clock that did not move) cannot leave the order ambiguous. Only changed entries are returned;
 * apply them through `patchGame`, which spreads each to every store that owns the title.
 */
export function moveInQueue(queue: GameGroup[], index: number, delta: number): { id: string; queuedAt: number }[] {
  const to = index + delta;
  if (index < 0 || index >= queue.length || to < 0 || to >= queue.length || delta === 0) return [];
  const order = queue.map((x) => x.primary);
  const [moved] = order.splice(index, 1);
  order.splice(to, 0, moved!);
  const base = Math.min(...queue.map((x) => x.primary.queuedAt!));
  return order.flatMap((g, i) => (g.queuedAt === base + i ? [] : [{ id: g.id, queuedAt: base + i }]));
}

/** Hours still ahead for a title with an estimate; never negative, undefined without one. */
export function remainingHours(group: GameGroup): number | undefined {
  const est = group.primary.hoursToBeat;
  if (est === undefined) return undefined;
  return Math.max(0, Math.round((est - totalHours(group.members)) * 10) / 10);
}

export interface PickOptions {
  installedOnly?: boolean;
  /** Only titles whose remaining time is known and at most this many hours. */
  maxHours?: number;
  genre?: string;
  tag?: string | null;
}

export function pickGame(groups: GameGroup[], o: PickOptions, random: () => number = Math.random): GameGroup | undefined {
  const genre = o.genre ? fold(o.genre) : "";
  const pool = groups.filter((x) => {
    if (!open(x.primary)) return false;
    if (o.installedOnly && !x.members.some((m) => m.installed)) return false;
    if (o.maxHours !== undefined) {
      const left = remainingHours(x);
      if (left === undefined || left > o.maxHours) return false;
    }
    if (genre && !x.members.some((m) => m.genres.some((t) => fold(t) === genre))) return false;
    if (o.tag && !(x.primary.tags ?? []).some((t) => tagKey(t) === o.tag)) return false;
    return true;
  });
  return pool[Math.floor(random() * pool.length)];
}

export interface BacklogPlan {
  /** Backlog and in-progress titles with an estimate. */
  estimated: number;
  /** Titles still without one, so the total is a floor, not a promise. */
  unestimated: number;
  hours: number;
  /** Null when no pace was given. */
  weeks: number | null;
}

export function backlogPlan(groups: GameGroup[], hoursPerWeek: number): BacklogPlan {
  let estimated = 0, unestimated = 0, hours = 0;
  for (const x of groups) {
    if (!open(x.primary)) continue;
    const left = remainingHours(x);
    if (left === undefined) { unestimated++; continue; }
    estimated++;
    hours += left;
  }
  hours = Math.round(hours * 10) / 10;
  return { estimated, unestimated, hours, weeks: hoursPerWeek > 0 ? Math.ceil(hours / hoursPerWeek) : null };
}
