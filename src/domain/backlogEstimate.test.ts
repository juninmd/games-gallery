import { describe, expect, it } from "vitest";
import { backlogEstimate, hoursLeft } from "./backlogEstimate";
import type { GameGroup } from "./duplicates";
import type { Game } from "./types";

const g = (over: Partial<Game>): Game => ({
  id: "x", title: "Game", platformId: "pc", providerId: "steam", year: 2020, genres: [], status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});
const group = (...members: Game[]): GameGroup => ({ primary: members[0]!, members });

describe("time to beat", () => {
  it("subtracts the hours played in every store, never going below zero", () => {
    expect(hoursLeft(group(g({ hoursToBeat: 40, playtimeH: 10 }), g({ id: "y", providerId: "gog", playtimeH: 5 })))).toBe(25);
    expect(hoursLeft(group(g({ hoursToBeat: 10, playtimeH: 30 })))).toBe(0);
    expect(hoursLeft(group(g({})))).toBeUndefined();
  });
  it("estimates only backlog and playing titles, and counts the ones without an estimate", () => {
    const e = backlogEstimate([
      group(g({ id: "1", hoursToBeat: 20 })),
      group(g({ id: "2", status: "playing", hoursToBeat: 30, playtimeH: 12 })),
      group(g({ id: "3", status: "backlog" })),
      group(g({ id: "4", status: "completed", hoursToBeat: 100 })),
      group(g({ id: "5", status: "wishlist", owned: false, hoursToBeat: 50 })),
    ]);
    expect(e).toEqual({ games: 3, remainingH: 38, withoutEstimate: 1 });
  });
});

describe("estimate shared across stores", () => {
  it("setting it on one copy sets it on your other copies of the same title", async () => {
    const { applyShared } = await import("./duplicates");
    const games = [g({ id: "s", title: "Hades" }), g({ id: "e", title: "Hades", providerId: "epic" })];
    expect(applyShared(games, "s", { hoursToBeat: 22 }).map((x) => x.hoursToBeat)).toEqual([22, 22]);
  });
});
