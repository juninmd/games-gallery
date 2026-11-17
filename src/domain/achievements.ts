/** Steam achievement progress for one game, from `ISteamUserStats/GetPlayerAchievements`. */
export interface AchievementSummary {
  total: number;
  unlocked: number;
  /** Most recently unlocked first. */
  recent: { name: string; description?: string; unlockedAt: string }[];
}

const MAX_ACHIEVEMENTS = 5000;
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** `null` when the game has no achievements or the response is not a success. */
export function parseAchievements(json: unknown, recentLimit = 5): AchievementSummary | null {
  const stats = (json as { playerstats?: { success?: unknown; achievements?: unknown } } | null)?.playerstats;
  if (stats?.success !== true || !Array.isArray(stats.achievements) || !stats.achievements.length) return null;
  const list = stats.achievements.slice(0, MAX_ACHIEVEMENTS) as Record<string, unknown>[];
  const done = list.filter((a) => a?.["achieved"] === 1);
  const recent = done
    .filter((a) => typeof a["unlocktime"] === "number" && Number.isFinite(a["unlocktime"]) && (a["unlocktime"] as number) > 0)
    .sort((a, b) => (b["unlocktime"] as number) - (a["unlocktime"] as number))
    .slice(0, recentLimit)
    .map((a) => ({
      name: text(a["name"], 200) ?? text(a["apiname"], 200) ?? "Conquista",
      description: text(a["description"], 500),
      unlockedAt: new Date((a["unlocktime"] as number) * 1000).toISOString(),
    }));
  return { total: list.length, unlocked: done.length, recent };
}
