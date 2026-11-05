import { describe, expect, it } from "vitest";
import { groupGames } from "./duplicates";
import { backlogPlan, moveInQueue, nextSlot, pickGame, queueOf, remainingHours } from "./queue";
import type { Game } from "./types";

const g = (id: string, over: Partial<Game> = {}): Game => ({
  id, title: id, platformId: "pc", providerId: "steam", year: 2020, genres: ["RPG"], status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});
const groups = (list: Game[]) => groupGames(list);

describe("queueOf", () => {
  it("orders by slot and drops finished, dropped and unowned titles", () => {
    const q = queueOf(groups([
      g("late", { queuedAt: 30 }), g("early", { queuedAt: 10 }), g("done", { queuedAt: 20, status: "completed" }),
      g("wish", { queuedAt: 5, status: "wishlist", owned: false }), g("none"),
    ]));
    expect(q.map((x) => x.primary.id)).toEqual(["early", "late"]);
  });
  it("counts a title once however many stores own it", () => {
    const q = queueOf(groups([g("a", { title: "Hades", queuedAt: 1 }), g("b", { title: "Hades", providerId: "gog", queuedAt: 1 })]));
    expect(q).toHaveLength(1);
  });
});

describe("nextSlot / moveInQueue", () => {
  it("always lands after the current last even with a stalled clock", () => {
    expect(nextSlot(groups([g("a", { queuedAt: 100 })]), 50)).toBe(101);
    expect(nextSlot([], 50)).toBe(50);
  });
  const queue = (slots: number[]) => queueOf(groups(slots.map((s, i) => g(`g${i}`, { queuedAt: s }))));
  const apply = (q: ReturnType<typeof queue>, patches: { id: string; queuedAt: number }[]) =>
    q.map((x) => ({ id: x.primary.id, queuedAt: patches.find((p) => p.id === x.primary.id)?.queuedAt ?? x.primary.queuedAt! })).sort((a, b) => a.queuedAt - b.queuedAt).map((x) => x.id);
  it("moves an entry and keeps the rest in order, even with sparse slots", () => {
    const q = queue([100, 500, 900]);
    expect(apply(q, moveInQueue(q, 2, -1))).toEqual(["g0", "g2", "g1"]);
    expect(apply(q, moveInQueue(q, 0, 1))).toEqual(["g1", "g0", "g2"]);
  });
  it("resolves tied slots instead of leaving the order to chance", () => {
    const q = queue([7, 7, 7]);
    const next = apply(q, moveInQueue(q, 1, -1));
    expect(next[0]).toBe(q[1]!.primary.id);
    expect(new Set(next).size).toBe(3);
  });
  it("ignores moves past either end and returns only the entries that changed", () => {
    const q = queue([1, 2, 3]);
    expect(moveInQueue(q, 0, -1)).toEqual([]);
    expect(moveInQueue(q, 2, 1)).toEqual([]);
    expect(moveInQueue(q, 0, 0)).toEqual([]);
    expect(moveInQueue(q, 0, 1)).toEqual([{ id: "g1", queuedAt: 1 }, { id: "g0", queuedAt: 2 }]);
  });
});

describe("remainingHours", () => {
  it("subtracts what you already played, floors at zero and needs an estimate", () => {
    const [a, b, c] = groups([g("a", { hoursToBeat: 20, playtimeH: 4.5 }), g("b", { hoursToBeat: 5, playtimeH: 9 }), g("c")]);
    expect([remainingHours(a!), remainingHours(b!), remainingHours(c!)]).toEqual([15.5, 0, undefined]);
  });
});

describe("pickGame", () => {
  const lib = groups([
    g("short", { hoursToBeat: 4, installed: true, genres: ["Puzzle"], tags: ["Cozy"] }),
    g("long", { hoursToBeat: 80, genres: ["RPG"] }),
    g("noest", { installed: true }),
    g("done", { status: "completed", hoursToBeat: 2, installed: true }),
  ]);
  const first = () => 0;
  it("honours each filter", () => {
    expect(pickGame(lib, { installedOnly: true, maxHours: 10 }, first)?.primary.id).toBe("short");
    expect(pickGame(lib, { genre: "rpg" }, first)?.primary.id).toBe("long");
    expect(pickGame(lib, { tag: "cozy" }, first)?.primary.id).toBe("short");
    expect(pickGame(lib, { maxHours: 1 }, first)).toBeUndefined();
  });
  it("never offers a finished game, and is undefined on an empty pool", () => {
    expect(pickGame(lib, { installedOnly: true }, () => 0.99)?.primary.id).not.toBe("done");
    expect(pickGame([], {})).toBeUndefined();
  });
});

describe("backlogPlan", () => {
  it("sums remaining hours, flags unestimated titles and converts to weeks", () => {
    const p = backlogPlan(groups([g("a", { hoursToBeat: 10 }), g("b", { hoursToBeat: 5, playtimeH: 1, status: "playing" }), g("c")]), 7);
    expect(p).toEqual({ estimated: 2, unestimated: 1, hours: 14, weeks: 2 });
    expect(backlogPlan(groups([g("a", { hoursToBeat: 10 })]), 0).weeks).toBeNull();
  });
});
