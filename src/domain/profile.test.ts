import { describe, expect, it } from "vitest";
import { computeProfile, xpForLevel, xpOf } from "./profile";

const stats = (hours: number, completed = 0, rated = 0) => ({
  hours,
  byStatus: { playing: 0, backlog: 0, completed, dropped: 0, wishlist: 0 },
  ratings: [0, 0, 0, 0, rated] as [number, number, number, number, number],
});

describe("profile", () => {
  it("weighs hours, finished games and ratings", () => {
    expect(xpOf(stats(100, 2, 5))).toBe(100 + 40 + 10);
  });

  it("starts at level 1 with no activity", () => {
    const p = computeProfile(stats(0));
    expect(p).toMatchObject({ level: 1, title: "Novato", xp: 0, levelStart: 0, nextLevelAt: 40, progress: 0 });
  });

  it("level boundaries follow xpForLevel", () => {
    expect(computeProfile(stats(xpForLevel(5) - 1)).level).toBe(4);
    expect(computeProfile(stats(xpForLevel(5))).level).toBe(5);
  });

  it("reports progress inside the level and a title for the tier", () => {
    const p = computeProfile(stats(xpForLevel(10) + 90));
    expect(p.level).toBe(10);
    expect(p.title).toBe("Veterano");
    expect(p.progress).toBeCloseTo(90 / (xpForLevel(11) - xpForLevel(10)));
  });
});
