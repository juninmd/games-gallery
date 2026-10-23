import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";
import type { Game } from "./types";

const g = (over: Partial<Game>): Game => ({
  id: "x", title: "T", platformId: "pc", providerId: "steam", year: 2000, genres: [],
  status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});

describe("computeStats", () => {
  it("is all zeros for an empty library, without NaN", () => {
    const s = computeStats([]);
    expect(s).toMatchObject({ owned: 0, wishlist: 0, hours: 0, completionRate: 0, untouched: 0, installedGb: 0, avgRating: undefined });
    expect(s.byPlatform).toEqual([]);
  });
  it("keeps wishlist games out of owned totals, hours and buckets", () => {
    const s = computeStats([g({ id: "a", playtimeH: 10 }), g({ id: "b", status: "wishlist", owned: false, playtimeH: 99, platformId: "ps5" })]);
    expect(s).toMatchObject({ owned: 1, wishlist: 1, hours: 10 });
    expect(s.byPlatform.map((b) => b.id)).toEqual(["pc"]);
    expect(s.byStatus.wishlist).toBe(1);
  });
  it("computes completion rate, average rating and the histogram", () => {
    const s = computeStats([
      g({ id: "1", status: "completed", rating: 5 }), g({ id: "2", status: "completed", rating: 4 }),
      g({ id: "3", rating: 4 }), g({ id: "4" }),
    ]);
    expect(s.completionRate).toBe(0.5);
    expect(s.avgRating).toBe(4.3);
    expect(s.ratings).toEqual([0, 0, 0, 2, 1]);
  });
  it("counts only never-played owned backlog as untouched", () => {
    const s = computeStats([g({ id: "1" }), g({ id: "2", playtimeH: 2 }), g({ id: "3", status: "playing" }), g({ id: "4", status: "wishlist", owned: false })]);
    expect(s.untouched).toBe(1);
  });
  it("sorts buckets by count, then hours, then id, deterministically", () => {
    const s = computeStats([
      g({ id: "1", platformId: "ps2", playtimeH: 1 }), g({ id: "2", platformId: "gba", playtimeH: 5 }),
      g({ id: "3", platformId: "pc" }), g({ id: "4", platformId: "pc" }),
    ]);
    expect(s.byPlatform.map((b) => b.id)).toEqual(["pc", "gba", "ps2"]);
  });
  it("lists most played first, ignoring unplayed, capped by `top`", () => {
    const s = computeStats([g({ id: "a", title: "A", playtimeH: 3 }), g({ id: "b", title: "B", playtimeH: 9 }), g({ id: "c", title: "C" })], 1);
    expect(s.mostPlayed.map((x) => x.id)).toEqual(["b"]);
  });
  it("sums installed size only for installed games", () => {
    expect(computeStats([g({ id: "1", installed: true, sizeGb: 10.4 }), g({ id: "2", sizeGb: 50 })]).installedGb).toBe(10);
  });
});
