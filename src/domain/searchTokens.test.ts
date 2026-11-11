import { describe, expect, it } from "vitest";
import { EMPTY_FILTER } from "./filter";
import { absorbTokens, filterChips, parseSearchWord } from "./searchTokens";

describe("parseSearchWord", () => {
  it("recognizes platforms, statuses, stores, flags and tags", () => {
    expect(parseSearchWord("PS2", EMPTY_FILTER)).toEqual({ platformId: "ps2" });
    expect(parseSearchWord("zerado", EMPTY_FILTER)).toEqual({ status: "completed" });
    expect(parseSearchWord("Steam", EMPTY_FILTER)).toEqual({ providerIds: ["steam"] });
    expect(parseSearchWord("battle.net", EMPTY_FILTER)).toEqual({ providerIds: ["battlenet"] });
    expect(parseSearchWord("instalados", EMPTY_FILTER)).toEqual({ installedOnly: true });
    expect(parseSearchWord("#coop", EMPTY_FILTER)).toEqual({ tag: "coop" });
  });

  it("leaves ordinary words for the title search", () => {
    expect(parseSearchWord("zelda", EMPTY_FILTER)).toBeNull();
    expect(parseSearchWord("#", EMPTY_FILTER)).toBeNull();
  });

  it("does not add the same store twice", () => {
    expect(parseSearchWord("gog", { ...EMPTY_FILTER, providerIds: ["gog"] })).toEqual({});
  });
});

describe("absorbTokens", () => {
  it("converts only finished words and keeps the rest as the query", () => {
    expect(absorbTokens("ps2 zerado ", EMPTY_FILTER)).toEqual({ patch: { platformId: "ps2", status: "completed" }, rest: "" });
    expect(absorbTokens("steam hol", EMPTY_FILTER)).toEqual({ patch: { providerIds: ["steam"] }, rest: "hol" });
    expect(absorbTokens("epic", EMPTY_FILTER)).toEqual({ patch: {}, rest: "epic" });
    expect(absorbTokens("hollow knight ", EMPTY_FILTER)).toEqual({ patch: {}, rest: "hollow knight " });
  });
});

describe("filterChips", () => {
  it("lists every active filter with a way to clear it", () => {
    const chips = filterChips({ ...EMPTY_FILTER, platformId: "ps2", providerIds: ["steam", "gog"], loanedOnly: true });
    expect(chips.map((c) => c.label)).toEqual(["PS2", "Steam", "GOG", "Emprestados"]);
    expect(chips[1]!.clear).toEqual({ providerIds: ["gog"] });
  });

  it("hides the installed chip on the Installed screen", () => {
    expect(filterChips({ ...EMPTY_FILTER, installedOnly: true }, true)).toEqual([]);
  });
});
