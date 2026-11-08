import { describe, expect, it } from "vitest";
import { sanitizeGame } from "./backup";
import { addTag, hasTag, loanDays, MAX_TAGS, normalizeTags, removeTag, tagCounts } from "./collection";
import { applyShared } from "./duplicates";
import { EMPTY_FILTER, filterGames, hasActiveFilter } from "./filter";
import { game } from "./gameFactory";

describe("tags", () => {
  it("normalizes spacing and drops case/accent duplicates", () => {
    expect(normalizeTags(["  Co-op  local ", "co-op LOCAL", "Viagem", "viágem", "", 3])).toEqual(["Co-op local", "Viagem"]);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(MAX_TAGS);
  });

  it("adds, refuses duplicates and removes", () => {
    const g = game("pc", "steam", "Hades", 2020, "Roguelike");
    const withTag = { ...g, ...addTag(g, "Coop") };
    expect(withTag.tags).toEqual(["Coop"]);
    expect(addTag(withTag, "coop")).toBeUndefined();
    expect(hasTag(withTag, "COOP")).toBe(true);
    expect(removeTag(withTag, "coop")).toEqual({ tags: undefined });
  });

  it("counts tags across the library, most used first", () => {
    const a = { ...game("pc", "steam", "A", 2020, "X"), tags: ["Coop", "Curto"] };
    const b = { ...game("pc", "gog", "B", 2020, "X"), tags: ["coop"] };
    expect(tagCounts([a, b])).toEqual([["Coop", 2], ["Curto", 1]]);
  });

  it("filters and searches by tag", () => {
    const a = { ...game("pc", "steam", "A", 2020, "X"), tags: ["Coop"] };
    const b = game("pc", "gog", "B", 2020, "X");
    expect(filterGames([a, b], { ...EMPTY_FILTER, tag: "coop" }).map((g) => g.title)).toEqual(["A"]);
    expect(filterGames([a, b], { ...EMPTY_FILTER, query: "coop" }).map((g) => g.title)).toEqual(["A"]);
    expect(hasActiveFilter({ ...EMPTY_FILTER, tag: "coop" })).toBe(true);
    expect(hasActiveFilter(EMPTY_FILTER)).toBe(false);
  });

  it("spreads tags to the same game in other stores", () => {
    const steam = game("pc", "steam", "Hades", 2020, "Roguelike");
    const epic = game("pc", "epic", "Hades", 2020, "Roguelike");
    const next = applyShared([steam, epic], steam.id, { tags: ["Coop"] });
    expect(next.map((g) => g.tags)).toEqual([["Coop"], ["Coop"]]);
  });
});

describe("loans", () => {
  it("counts whole days and tolerates bad dates", () => {
    expect(loanDays("2026-11-01T10:00:00Z", new Date("2026-11-08T12:00:00Z"))).toBe(7);
    expect(loanDays("nope")).toBe(0);
  });

  it("filters lent copies", () => {
    const a = { ...game("ps2", "physical", "Okami", 2006, "Aventura"), loan: { to: "Ana", since: "2026-11-01" } };
    const b = game("ps2", "roms", "Ico", 2001, "Aventura");
    expect(filterGames([a, b], { ...EMPTY_FILTER, loanedOnly: true }).map((g) => g.title)).toEqual(["Okami"]);
  });

  it("keeps a loan only on an owned physical copy when restoring", () => {
    const base = { ...game("ps2", "physical", "Okami", 2006, "Aventura"), tags: [" Coop ", "coop"] };
    const loan = { to: " Ana ", since: "2026-11-01T00:00:00.000Z" };
    expect(sanitizeGame({ ...base, loan })).toMatchObject({ loan: { to: "Ana" }, tags: ["Coop"] });
    expect(sanitizeGame({ ...base, providerId: "steam", loan })?.loan).toBeUndefined();
    expect(sanitizeGame({ ...base, loan: { to: "Ana", since: "x" } })?.loan).toBeUndefined();
    expect(sanitizeGame({ ...base, status: "wishlist", owned: false, loan })?.loan).toBeUndefined();
  });
});
