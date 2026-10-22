import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, filterGames, libraryStats } from "./filter";
import { game } from "./seed/build";

const games = [
  game("pc", "steam", "Pokémon Showdown", 2012, "Estratégia", { s: "playing", i: true, h: 10 }),
  game("pc", "gog", "Disco Elysium", 2019, "RPG", { s: "backlog" }),
  game("ps1", "roms", "Final Fantasy VII", 1997, "JRPG", { s: "wishlist" }),
];

describe("filterGames", () => {
  it("matches titles ignoring case and accents", () => {
    expect(filterGames(games, { ...EMPTY_FILTER, query: "pokemon" })).toHaveLength(1);
    expect(filterGames(games, { ...EMPTY_FILTER, query: "POKÉMON" })).toHaveLength(1);
  });

  it("matches genres too", () => {
    expect(filterGames(games, { ...EMPTY_FILTER, query: "jrpg" }).map((g) => g.title)).toEqual(["Final Fantasy VII"]);
  });

  it("combines provider, platform and installed filters with AND", () => {
    const r = filterGames(games, { ...EMPTY_FILTER, providerIds: ["steam", "gog"], installedOnly: true });
    expect(r.map((g) => g.title)).toEqual(["Pokémon Showdown"]);
  });

  it("does not mutate its input when sorting", () => {
    const copy = [...games];
    filterGames(games, { ...EMPTY_FILTER, sort: "year" });
    expect(games).toEqual(copy);
  });
});

describe("libraryStats", () => {
  it("counts wishlist as not owned and never installed", () => {
    const s = libraryStats(games);
    expect(s).toMatchObject({ total: 3, owned: 2, installed: 1, backlog: 1, hours: 10 });
  });
});
