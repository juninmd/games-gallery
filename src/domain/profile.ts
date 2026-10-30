import type { Stats } from "./stats";

export interface Profile {
  level: number;
  title: string;
  xp: number;
  /** XP at which the current level starts / the next one begins. */
  levelStart: number;
  nextLevelAt: number;
  /** 0..1 progress inside the current level. */
  progress: number;
}

/** Hours played count 1:1, each finished game is worth 20 h and each rating 2 h. */
export const xpOf = (s: Pick<Stats, "hours" | "byStatus" | "ratings">): number =>
  Math.round(s.hours + 20 * s.byStatus.completed + 2 * s.ratings.reduce((a, b) => a + b, 0));

/** XP needed to reach `level` (level 1 starts at 0). */
export const xpForLevel = (level: number): number => 40 * (level - 1) ** 2;

const TITLES: [minLevel: number, title: string][] = [
  [1, "Novato"],
  [3, "Explorador"],
  [6, "Caçador de troféus"],
  [10, "Veterano"],
  [15, "Mestre colecionador"],
  [22, "Lenda da galeria"],
];

export function computeProfile(stats: Pick<Stats, "hours" | "byStatus" | "ratings">): Profile {
  const xp = xpOf(stats);
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const levelStart = xpForLevel(level);
  const nextLevelAt = xpForLevel(level + 1);
  const title = [...TITLES].reverse().find(([min]) => level >= min)?.[1] ?? TITLES[0]![1];
  return { level, title, xp, levelStart, nextLevelAt, progress: (xp - levelStart) / (nextLevelAt - levelStart) };
}
