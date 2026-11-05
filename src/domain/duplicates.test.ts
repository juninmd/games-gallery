import { describe, expect, it } from "vitest";
import { applyShared, duplicateKey, featuredGroup, filterGameGroups, groupGames, groupStats, nowPlayingGroups, pickBacklog, siblingsOf, totalHours } from "./duplicates";
import { EMPTY_FILTER } from "./filter";
import type { Game } from "./types";

const g = (over: Partial<Game> & Pick<Game, "id" | "title" | "providerId">): Game => ({
  platformId: "pc", year: 2020, genres: [], status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});

const hades = [
  g({ id: "h-steam", title: "Hades", providerId: "steam", playtimeH: 12 }),
  g({ id: "h-epic", title: "Hades™", providerId: "epic", installed: true }),
  g({ id: "h-gog", title: "HADES", providerId: "gog" }),
];

describe("duplicateKey", () => {
  it("ignores case, accents, trademark symbols and punctuation", () => {
    expect(duplicateKey(g({ id: "a", title: "Pokémon: Showdown™", providerId: "steam" }))).toBe(duplicateKey(g({ id: "b", title: "pokemon showdown", providerId: "gog" })));
  });
  it("never keys a title that folds to nothing, or a non-PC release", () => {
    expect(duplicateKey(g({ id: "a", title: "™ ®", providerId: "steam" }))).toBeNull();
    expect(duplicateKey(g({ id: "a", title: "Hades", providerId: "roms", platformId: "ps2" }))).toBeNull();
  });
  it("keeps CJK titles distinct", () => {
    expect(duplicateKey(g({ id: "a", title: "原神", providerId: "steam" }))).not.toBe(duplicateKey(g({ id: "b", title: "崩坏", providerId: "steam" })));
  });
});

describe("groupGames", () => {
  it("merges one title across different stores and lists every store", () => {
    const groups = groupGames(hades);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.members.map((m) => m.providerId).sort()).toEqual(["epic", "gog", "steam"]);
  });

  it("prefers the installed copy as primary, then owned, then playtime", () => {
    expect(groupGames(hades)[0]!.primary.id).toBe("h-epic");
    const noInstall = hades.map((x) => ({ ...x, installed: false }));
    expect(groupGames(noInstall)[0]!.primary.id).toBe("h-steam"); // most hours
    const wish = [g({ id: "w", title: "Hades", providerId: "gog", owned: false, status: "wishlist" }), g({ id: "o", title: "Hades", providerId: "epic" })];
    expect(groupGames(wish)[0]!.primary.id).toBe("o");
  });

  it("does not merge the same store listed twice (demos, re-imports) or other platforms", () => {
    const twice = [g({ id: "1", title: "Doom", providerId: "steam" }), g({ id: "2", title: "Doom", providerId: "steam" })];
    expect(groupGames(twice)).toHaveLength(2);
    const consoles = [g({ id: "1", title: "Doom", providerId: "roms", platformId: "ps2" }), g({ id: "2", title: "Doom", providerId: "psn", platformId: "ps2" })];
    expect(groupGames(consoles)).toHaveLength(2);
  });

  it("keeps the input order of first appearance and does not mutate it", () => {
    const input = [g({ id: "z", title: "Zed", providerId: "steam" }), ...hades, g({ id: "a", title: "Alpha", providerId: "gog" })];
    const copy = [...input];
    expect(groupGames(input).map((x) => x.primary.title)).toEqual(["Zed", "Hades™", "Alpha"]);
    expect(input).toEqual(copy);
  });

  it("handles an empty library", () => {
    expect(groupGames([])).toEqual([]);
  });
});

describe("siblingsOf", () => {
  it("returns the other stores that own the same game, never the game itself", () => {
    expect(siblingsOf(hades, hades[0]!).map((s) => s.id).sort()).toEqual(["h-epic", "h-gog"]);
    expect(siblingsOf([hades[0]!], hades[0]!)).toEqual([]);
  });
});

describe("filterGameGroups", () => {
  it("keeps a group when any store matches, but still shows every store", () => {
    const r = filterGameGroups(hades, { ...EMPTY_FILTER, providerIds: ["gog"] });
    expect(r).toHaveLength(1);
    expect(r[0]!.primary.providerId).toBe("gog");
    expect(r[0]!.members).toHaveLength(3);
  });

  it("can show only the games that live in more than one store", () => {
    const lib = [...hades, g({ id: "solo", title: "Solo", providerId: "steam" })];
    expect(filterGameGroups(lib, { ...EMPTY_FILTER, multiStoreOnly: true }).map((x) => x.primary.title)).toEqual(["Hades™"]);
    expect(filterGameGroups(lib, EMPTY_FILTER)).toHaveLength(2);
  });

  it("chooses the primary among the stores that pass (installed only -> the installed copy)", () => {
    const r = filterGameGroups(hades, { ...EMPTY_FILTER, installedOnly: true });
    expect(r[0]!.primary.id).toBe("h-epic");
    expect(filterGameGroups(hades, { ...EMPTY_FILTER, query: "nothing" })).toEqual([]);
  });

  it("sorts groups by the best store and sums hours for the playtime sort", () => {
    const lib = [
      ...hades.map((x) => (x.id === "h-gog" ? { ...x, playtimeH: 10 } : x)),
      g({ id: "b", title: "Beta", providerId: "steam", playtimeH: 20 }),
    ];
    expect(filterGameGroups(lib, { ...EMPTY_FILTER, sort: "title" }).map((x) => x.primary.title)).toEqual(["Beta", "Hades™"]);
    // Hades: 12h on Steam + 10h on GOG = 22h, more than Beta's 20h, though no single store beats it
    expect(filterGameGroups(lib, { ...EMPTY_FILTER, sort: "playtime" }).map((x) => x.primary.title)).toEqual(["Hades™", "Beta"]);
  });
});

describe("groupStats", () => {
  it("counts a title owned in three stores once and reports the folded copies", () => {
    const lib = [...hades, g({ id: "b", title: "Beta", providerId: "steam", playtimeH: 20 }), g({ id: "w", title: "Wish", providerId: "gog", owned: false, status: "wishlist" })];
    expect(groupStats(groupGames(lib))).toEqual({ total: 3, owned: 2, installed: 1, backlog: 2, hours: 32, duplicates: 1, foldedCopies: 2 });
    expect(groupStats([])).toMatchObject({ total: 0, duplicates: 0, foldedCopies: 0 });
  });
});

describe("separate flag", () => {
  it("keeps a copy the user marked as a different game out of the group, and can be merged back", () => {
    const split = hades.map((x) => (x.id === "h-gog" ? { ...x, separate: true } : x));
    expect(duplicateKey(split[2]!)).toBeNull();
    const groups = groupGames(split);
    expect(groups).toHaveLength(2);
    expect(groups.find((x) => x.members.length === 2)!.members.map((m) => m.providerId).sort()).toEqual(["epic", "steam"]);
    expect(groupGames(split.map((x) => ({ ...x, separate: undefined })))).toHaveLength(1);
  });
});

describe("shared fields survive a copy that lacks them", () => {
  const epic = g({ id: "e", title: "Hades", providerId: "epic", tags: ["roguelike", "co-op"], queuedAt: 7, hoursToBeat: 20 });
  const steam = g({ id: "s", title: "Hades", providerId: "steam", installed: true });
  it("shows the tags, queue slot and estimate of any owned copy on the primary", () => {
    const [x] = groupGames([epic, steam]);
    expect(x!.primary.id).toBe("s");
    expect(x!.primary).toMatchObject({ tags: ["roguelike", "co-op"], queuedAt: 7, hoursToBeat: 20 });
  });
  it("merges tags from several copies without duplicates and takes the earliest queue slot", () => {
    const [x] = groupGames([{ ...epic, tags: ["roguelike", "Co-op"], queuedAt: 9 }, { ...steam, tags: ["co-op", "cozy"], queuedAt: 3 }]);
    expect(x!.primary.tags).toEqual(["co-op", "cozy", "roguelike"]);
    expect(x!.primary.queuedAt).toBe(3);
  });
  it("keeps the same filtered view, and editing through the merged primary does not lose the other copy's tags", () => {
    const merged = filterGameGroups([epic, steam], EMPTY_FILTER)[0]!.primary;
    const out = applyShared([epic, steam], merged.id, { tags: [...(merged.tags ?? []), "rpg"] });
    expect(out.find((x) => x.id === "e")!.tags).toEqual(["roguelike", "co-op", "rpg"]);
  });
  it("leaves a single-store title untouched (same object)", () => {
    const solo = g({ id: "a", title: "Solo", providerId: "steam", tags: ["x"] });
    expect(groupGames([solo])[0]!.primary).toBe(solo);
  });
});

describe("applyShared", () => {
  it("copies status, rating and notes to every owned copy, but never ownership or hours", () => {
    const lib = [...hades, g({ id: "w", title: "Hades", providerId: "ubisoft", owned: false, status: "wishlist" })];
    const out = applyShared(lib, "h-steam", { status: "completed", owned: true, rating: 5, notes: "great", playtimeH: 99 });
    const by = (id: string) => out.find((x) => x.id === id)!;
    expect(by("h-epic")).toMatchObject({ status: "completed", rating: 5, notes: "great", playtimeH: 0 });
    expect(by("h-gog")).toMatchObject({ status: "completed", rating: 5 });
    expect(by("h-steam")).toMatchObject({ playtimeH: 99, status: "completed" });
    expect(by("w")).toMatchObject({ status: "wishlist", owned: false }); // a store you do not own it in stays a wish
  });

  it("spreads tags, time to beat and the queue slot to every owned copy", () => {
    const out = applyShared(hades, "h-steam", { tags: ["Cozy"], hoursToBeat: 20, queuedAt: 5 });
    for (const id of ["h-epic", "h-gog"]) expect(out.find((x) => x.id === id)).toMatchObject({ tags: ["Cozy"], hoursToBeat: 20, queuedAt: 5 });
    const cleared = applyShared(out, "h-epic", { queuedAt: undefined });
    expect(cleared.find((x) => x.id === "h-gog")!.queuedAt).toBeUndefined();
  });

  it("does not spread a wishlist move or purely local fields", () => {
    const wish = applyShared(hades, "h-steam", { status: "wishlist", owned: false, installed: false });
    expect(wish.find((x) => x.id === "h-epic")).toMatchObject({ owned: true, installed: true, status: "backlog" });
    const local = applyShared(hades, "h-steam", { installed: true, storeId: "x" });
    expect(local.find((x) => x.id === "h-gog")!.installed).toBe(false);
  });

  it("only touches the one game when it has no other store", () => {
    const solo = [g({ id: "a", title: "A", providerId: "steam" }), g({ id: "b", title: "B", providerId: "gog" })];
    expect(applyShared(solo, "a", { status: "playing", owned: true })[1]).toBe(solo[1]);
  });
});

describe("one-per-game picks", () => {
  const playing = hades.map((x) => ({ ...x, status: "playing" as const }));

  it("lists a game being played once, with the hours of every store", () => {
    const lib = [...playing, g({ id: "b", title: "Beta", providerId: "steam", status: "playing", playtimeH: 5 })];
    const now = nowPlayingGroups(groupGames(lib));
    expect(now.map((x) => x.primary.title)).toEqual(["Hades™", "Beta"]);
    expect(totalHours(now[0]!.members)).toBe(12);
  });

  it("features the game being played, else the most played, preferring one with art from any store", () => {
    const withArt = [g({ id: "a", title: "A", providerId: "steam", playtimeH: 50 }), g({ id: "a2", title: "A", providerId: "gog", coverUrl: "https://x/y.jpg" }), g({ id: "b", title: "B", providerId: "steam", playtimeH: 5, coverUrl: "https://x/b.jpg" })];
    expect(featuredGroup(groupGames(withArt))!.primary.title).toBe("A"); // 50 h, art found on the GOG copy
    expect(featuredGroup(groupGames(playing))!.members).toHaveLength(3);
    expect(featuredGroup([])).toBeUndefined();
  });

  it("raffles a backlog game once per title, never a wishlist or finished one", () => {
    const lib = [
      ...hades,
      g({ id: "w", title: "Wish", providerId: "gog", owned: false, status: "wishlist" }),
      g({ id: "d", title: "Done", providerId: "gog", status: "completed" }),
    ];
    const groups = groupGames(lib);
    expect(pickBacklog(groups, () => 0)!.members).toHaveLength(3);
    expect(pickBacklog(groups, () => 0.99)!.primary.title).toBe("Hades™"); // the only candidate
    expect(pickBacklog([], () => 0)).toBeUndefined();
  });
});
