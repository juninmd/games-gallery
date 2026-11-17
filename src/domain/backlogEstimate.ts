import { totalHours, type GameGroup } from "./duplicates";

export const MAX_HOURS_TO_BEAT = 10_000;

export interface BacklogEstimate {
  /** Backlog + playing titles considered. */
  games: number;
  /** Hours left on the titles that have an estimate. */
  remainingH: number;
  withoutEstimate: number;
}

/** Hours left for one title: estimate minus hours already played (all stores), never negative. */
export const hoursLeft = (group: GameGroup): number | undefined => {
  const beat = group.primary.hoursToBeat;
  return beat === undefined ? undefined : Math.max(0, Math.round((beat - totalHours(group.members)) * 10) / 10);
};

export function backlogEstimate(groups: GameGroup[]): BacklogEstimate {
  const open = groups.filter((g) => g.primary.status === "backlog" || g.primary.status === "playing");
  let remainingH = 0;
  let withoutEstimate = 0;
  for (const g of open) {
    const left = hoursLeft(g);
    if (left === undefined) withoutEstimate += 1;
    else remainingH += left;
  }
  return { games: open.length, remainingH: Math.round(remainingH), withoutEstimate };
}
