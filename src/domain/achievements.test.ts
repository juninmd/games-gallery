import { describe, expect, it } from "vitest";
import { parseAchievements } from "./achievements";

const ok = (achievements: unknown[]) => ({ playerstats: { success: true, achievements } });

describe("parseAchievements", () => {
  it("counts unlocked and lists the most recent first", () => {
    const r = parseAchievements(ok([
      { apiname: "A", achieved: 1, unlocktime: 100, name: "Primeira" },
      { apiname: "B", achieved: 0, unlocktime: 0, name: "Bloqueada" },
      { apiname: "C", achieved: 1, unlocktime: 300, name: " Última ", description: "Termine" },
    ]));
    expect(r).toMatchObject({ total: 3, unlocked: 2 });
    expect(r?.recent.map((a) => a.name)).toEqual(["Última", "Primeira"]);
    expect(r?.recent[0]).toMatchObject({ description: "Termine", unlockedAt: new Date(300_000).toISOString() });
  });

  it("returns null for games without stats, failures and junk", () => {
    expect(parseAchievements({ playerstats: { success: false, error: "Requested app has no stats" } })).toBeNull();
    expect(parseAchievements(ok([]))).toBeNull();
    expect(parseAchievements(null)).toBeNull();
    expect(parseAchievements("x")).toBeNull();
  });

  it("falls back to the api name and ignores unlocks without a valid time in the recent list", () => {
    const r = parseAchievements(ok([{ apiname: "RAW", achieved: 1, unlocktime: 5 }, { achieved: 1, unlocktime: "x" }, null]));
    expect(r).toMatchObject({ total: 3, unlocked: 2 });
    expect(r?.recent.map((a) => a.name)).toEqual(["RAW"]);
  });
});
