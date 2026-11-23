import { describe, expect, it } from "vitest";
import { classifyDrop, MAX_DROPPED } from "./drop";
import { facetsBy, matchFacets } from "./facets";
import { EMPTY_FILTER } from "./filter";
import { filterFromSearch, filterToSearch } from "./filterUrl";
import { layoutFor } from "./layout";
import { isOffline, nextFailures } from "./netHealth";
import { CHART_DAYS, mergeRows, minutesByGame } from "./playChart";
import type { Game } from "./types";

const VIEWS = ["library", "installed", "stats"] as const;
const g = (id: string, over: Partial<Game> = {}): Game => ({
  id, title: id, platformId: "pc", providerId: "steam", year: 2020, genres: [], status: "backlog",
  owned: true, installed: false, playtimeH: 0, ...over,
});

describe("layoutFor", () => {
  it("switches to the side rail exactly at 768px", () => {
    expect(layoutFor(767)).toBe("tabs");
    expect(layoutFor(768)).toBe("sidebar");
  });
});

describe("offline detection", () => {
  it("needs two failures in a row; any success resets", () => {
    let n = nextFailures(0, false);
    expect(isOffline(n)).toBe(false);
    n = nextFailures(n, false);
    expect(isOffline(n)).toBe(true);
    expect(isOffline(nextFailures(n, true))).toBe(false);
  });
});

describe("filter URL", () => {
  it("round-trips every field and writes nothing for the defaults", () => {
    expect(filterToSearch("library", EMPTY_FILTER)).toBe("");
    const filter = { ...EMPTY_FILTER, query: "zelda é", providerIds: ["steam", "gog"], platformId: "snes", status: "playing" as const, tag: "Coop", installedOnly: true, loanedOnly: true, sort: "year" as const };
    const back = filterFromSearch(filterToSearch("stats", filter), VIEWS);
    expect(back).toEqual({ view: "stats", filter });
  });

  it("drops hostile or unknown values instead of trusting the URL", () => {
    const long = "x".repeat(101);
    const { view, filter } = filterFromSearch(`?view=__proto__&status=evil&sort=drop&q=${long}&store=a,a,,b&installed=true`, VIEWS);
    expect(view).toBeNull();
    expect(filter).toEqual({ ...EMPTY_FILTER, providerIds: ["a", "b"] });
  });
});

describe("facetsBy", () => {
  it("counts per key, biggest first, with the most played cover as thumbnail", () => {
    const games = [g("a", { coverUrl: "https://x/a", playtimeH: 1 }), g("b", { coverUrl: "https://x/b", playtimeH: 9 }), g("c", { platformId: "snes" })];
    const facets = facetsBy(games, (x) => [x.platformId], (id) => id.toUpperCase());
    expect(facets).toEqual([{ id: "pc", label: "PC", count: 2, thumb: "https://x/b" }, { id: "snes", label: "SNES", count: 1, thumb: undefined }]);
    expect(matchFacets(facets, "sn").map((f) => f.id)).toEqual(["snes"]);
  });

  it("counts a game once even when a key repeats", () => {
    expect(facetsBy([g("a")], () => ["x", "x"], (k) => k)[0]!.count).toBe(1);
  });
});

describe("classifyDrop", () => {
  it("routes images to covers, ROMs to import and ignores the rest", () => {
    const plan = classifyDrop(["C:\\Games\\snes\\Chrono Trigger (USA).sfc", "/home/u/box.PNG", "/home/u/notes.txt", "/home/u/folder"]);
    expect(plan.covers).toEqual(["/home/u/box.PNG"]);
    expect(plan.roms).toEqual([expect.objectContaining({ platformId: "snes", title: "Chrono Trigger", path: "C:\\Games\\snes\\Chrono Trigger (USA).sfc" })]);
    expect(plan.ignored).toBe(2);
  });

  it("caps a huge drop", () => {
    const plan = classifyDrop(Array.from({ length: MAX_DROPPED + 5 }, (_, i) => `/x/${i}.txt`));
    expect(plan.ignored).toBe(MAX_DROPPED + 5);
  });
});

describe("minutesByGame", () => {
  const now = new Date(2026, 10, 23, 15).getTime();
  const at = (daysAgo: number, minutes?: number, gameId = "a") => ({ gameId, start: new Date(2026, 10, 23 - daysAgo, 10).toISOString(), minutes, kind: "exec" as const });

  it("buckets measured minutes per local day, today last, and skips the rest", () => {
    const rows = minutesByGame([at(0, 30), at(0, 15), at(13, 60), at(14, 99), at(1)], now);
    const row = rows.get("a")!;
    expect(row).toHaveLength(CHART_DAYS);
    expect(row[CHART_DAYS - 1]).toBe(45);
    expect(row[0]).toBe(60);
    expect(row.reduce((s, x) => s + x, 0)).toBe(105);
  });

  it("merges store copies and reports nothing when unplayed", () => {
    expect(mergeRows([undefined])).toBeUndefined();
    expect(mergeRows([[1, 2], undefined, [3, 4]])).toEqual([4, 6]);
  });
});
