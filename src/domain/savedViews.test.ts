import { describe, expect, it } from "vitest";
import { EMPTY_FILTER } from "./filter";
import { MAX_VIEWS, isEmptyFilter, sanitizeFilter, sanitizeViews } from "./savedViews";

describe("sanitizeFilter", () => {
  it("keeps known values and drops unknown providers, platforms, statuses and sorts", () => {
    const f = sanitizeFilter({ query: "ha", providerIds: ["steam", "steam", "constructor", 7], platformId: "toString", status: "bogus", sort: "evil", installedOnly: true, ownedOnly: "yes" });
    expect(f).toMatchObject({ query: "ha", providerIds: ["steam"], platformId: null, status: null, sort: "title", installedOnly: true, ownedOnly: false });
  });
  it("turns junk into the empty filter", () => {
    expect(sanitizeFilter(null)).toEqual(EMPTY_FILTER);
    expect(sanitizeFilter("x")).toEqual(EMPTY_FILTER);
  });
});

describe("sanitizeViews", () => {
  it("needs an id and a name, trims the name and rejects duplicate ids", () => {
    const v = sanitizeViews([{ id: "a", name: "  Cozy\n curtos " }, { id: "a", name: "dup" }, { id: "", name: "x" }, { id: "b" }, null]);
    expect(v.map((x) => [x.id, x.name])).toEqual([["a", "Cozy curtos"]]);
  });
  it("caps how many views are kept", () => {
    expect(sanitizeViews(Array.from({ length: 80 }, (_, i) => ({ id: `v${i}`, name: `n${i}` })))).toHaveLength(MAX_VIEWS);
  });
});

describe("isEmptyFilter", () => {
  it("is true only when nothing constrains the library", () => {
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true);
    expect(isEmptyFilter({ ...EMPTY_FILTER, tag: "cozy" })).toBe(false);
    expect(isEmptyFilter({ ...EMPTY_FILTER, sort: "year" })).toBe(true);
  });
});
