import { describe, expect, it } from "vitest";
import { MAX_LOG, addEntries, buildWrapped, dayOf, diffPlaytime, longestStreak, sanitizeLog, type PlayEntry } from "./playLog";
import type { Game } from "./types";

const g = (id: string, over: Partial<Game> = {}): Game => ({
  id, title: id, platformId: "pc", providerId: "steam", year: 2020, genres: ["RPG"], status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});
const day = (iso: string) => dayOf(Date.parse(`${iso}T12:00:00Z`));

describe("diffPlaytime", () => {
  it("reports growth only, sets a baseline for new games and ignores corrections", () => {
    const prev = new Map([["a", 10], ["b", 5], ["gone", 3]]);
    const { deltas, next } = diffPlaytime(prev, [g("a", { playtimeH: 12.5 }), g("b", { playtimeH: 4 }), g("new", { playtimeH: 99 })]);
    expect(deltas).toEqual([{ title: "a", hours: 2.5 }]);
    // "b" went down 5 -> 4: a correction, and the baseline stays at the 5 h ceiling
    expect([...next.entries()]).toEqual([["a", 12.5], ["b", 5], ["new", 99]]);
  });
  it("is empty when nothing changed and survives float noise", () => {
    expect(diffPlaytime(new Map([["a", 0.1 + 0.2]]), [g("a", { playtimeH: 0.3 })]).deltas).toEqual([]);
  });
});

describe("diffPlaytime keeps the highest baseline", () => {
  it("does not count typing a number digit by digit as play time", () => {
    let prev = new Map([["a", 120]]);
    const logged: number[] = [];
    for (const typed of [1, 12, 125]) {
      const r = diffPlaytime(prev, [g("a", { playtimeH: typed })]);
      logged.push(...r.deltas.map((d) => d.hours));
      prev = r.next;
    }
    expect(logged).toEqual([5]);
  });
  it("keeps the old ceiling when a lower snapshot replaces it, so re-growth is not counted twice", () => {
    const prev = new Map([["a", 100]]);
    expect(diffPlaytime(prev, [g("a", { playtimeH: 40 })]).next.get("a")).toBe(100);
    expect(diffPlaytime(prev, [g("a", { playtimeH: 130 })]).next.get("a")).toBe(130);
  });
});

describe("addEntries", () => {
  it("merges the same title on the same day regardless of store spelling, and keeps other days apart", () => {
    let log: PlayEntry[] = [];
    log = addEntries(log, [{ title: "Hades", hours: 1 }], 10);
    log = addEntries(log, [{ title: "HADES™", hours: 0.5 }], 10);
    log = addEntries(log, [{ title: "Hades", hours: 2 }], 11);
    expect(log).toEqual([{ d: 10, title: "Hades", h: 1.5 }, { d: 11, title: "Hades", h: 2 }]);
  });
  it("returns the same array for no deltas, skips untitled ones and bounds the log", () => {
    const log: PlayEntry[] = [];
    expect(addEntries(log, [], 1)).toBe(log);
    expect(addEntries(log, [{ title: "™", hours: 1 }], 1)).toEqual([]);
    const big = addEntries(Array.from({ length: MAX_LOG }, (_, i) => ({ d: i, title: `t${i}`, h: 1 })), [{ title: "new", hours: 1 }], 99999);
    expect(big).toHaveLength(MAX_LOG);
    expect(big.at(-1)!.title).toBe("new");
  });
});

describe("sanitizeLog", () => {
  it("keeps only well-formed positive entries", () => {
    expect(sanitizeLog([{ d: 5, title: "a", h: 1 }, { d: -1, title: "a", h: 1 }, { d: 1.5, title: "a", h: 1 }, { d: 1, title: "", h: 1 }, { d: 1, title: "a", h: 0 }, { d: 1, title: "a", h: Infinity }, null, "x"])).toEqual([{ d: 5, title: "a", h: 1 }]);
    expect(sanitizeLog({})).toEqual([]);
  });
});

describe("longestStreak", () => {
  it("counts consecutive days once each", () => {
    expect(longestStreak([1, 2, 2, 3, 7, 8])).toBe(3);
    expect(longestStreak([])).toBe(0);
    expect(longestStreak([5])).toBe(1);
  });
});

describe("dayOf follows the local calendar", () => {
  it("puts 22:00 at UTC-3 on the same local day, and 23:30 at UTC+2 on the next", () => {
    const at2200Utc = Date.parse("2026-12-31T22:00:00Z");
    expect(dayOf(at2200Utc, 180)).toBe(dayOf(Date.parse("2026-12-31T12:00:00Z"), 0));
    expect(dayOf(Date.parse("2026-12-31T23:30:00Z"), -120)).toBe(dayOf(Date.parse("2027-01-01T12:00:00Z"), 0));
  });
});

describe("buildWrapped", () => {
  const log: PlayEntry[] = [
    { d: day("2026-01-10"), title: "Hades", h: 3 }, { d: day("2026-01-11"), title: "Hades", h: 2 }, { d: day("2026-03-02"), title: "Celeste", h: 1.25 },
    { d: day("2025-12-31"), title: "Old", h: 50 },
  ];
  const games = [
    g("h1", { title: "Hades", playtimeH: 20, status: "completed", genres: ["Roguelike", "Ação"] }),
    g("h2", { title: "Hades", providerId: "gog", playtimeH: 5, status: "completed", genres: ["Roguelike", "Ação"] }),
    g("c", { title: "Celeste", playtimeH: 10, genres: ["Plataforma"] }),
    g("w", { title: "Wish", owned: false, status: "wishlist", playtimeH: 0 }),
  ];
  const w = buildWrapped(log, games, 2026);

  it("summarises only the requested year of the log", () => {
    expect(w.logged).toMatchObject({ hours: 6.3, activeDays: 3, longestStreak: 2, busiestMonth: 0 });
    expect(w.logged.top).toEqual([{ title: "Hades", hours: 5 }, { title: "Celeste", hours: 1.3 }]);
    expect(buildWrapped(log, games, 2024).logged).toMatchObject({ hours: 0, activeDays: 0, busiestMonth: undefined, top: [] });
  });
  it("counts a title once across stores and ignores the wishlist", () => {
    expect(w.library).toMatchObject({ owned: 2, completed: 1, hours: 35 });
    // both genres share the same 25 h, so the tie breaks alphabetically
    expect(w.library.topGenres.slice(0, 2)).toEqual([{ genre: "Ação", hours: 25 }, { genre: "Roguelike", hours: 25 }]);
    expect(w.library.topStores).toEqual([{ providerId: "steam", hours: 30 }, { providerId: "gog", hours: 5 }]);
  });
});
