import { describe, expect, it } from "vitest";
import { catalogKey, gamePassIndex, inGamePass, parseDeck, parseGamePassIds, parseGamePassTitles, parseProtonDb } from "./compat";

describe("parseProtonDb", () => {
  it("reads the tier and report count from the live summary shape", () => {
    expect(parseProtonDb({ bestReportedTier: "platinum", confidence: "strong", score: 0.79, tier: "gold", total: 2107, trendingTier: "platinum" })).toEqual({ tier: "gold", total: 2107 });
  });
  it("rejects unknown tiers, bad counts and non-objects", () => {
    expect(parseProtonDb({ tier: "diamond", total: 1 })).toBeUndefined();
    expect(parseProtonDb({ tier: "gold", total: -1 })).toBeUndefined();
    expect(parseProtonDb({ tier: "gold", total: 1.5 })).toBeUndefined();
    expect(parseProtonDb({ tier: "gold" })).toBeUndefined();
    expect(parseProtonDb(null)).toBeUndefined();
    expect(parseProtonDb([])).toBeUndefined();
  });
});

describe("parseDeck", () => {
  const res = (resolved_category: unknown, success: unknown = 1) => ({ success, results: { appid: 1, resolved_category } });
  it("maps Steam's categories", () => {
    expect([0, 1, 2, 3].map((c) => parseDeck(res(c)))).toEqual(["unknown", "unsupported", "playable", "verified"]);
  });
  it("refuses unsuccessful, unknown or prototype-ish answers", () => {
    expect(parseDeck(res(3, 0))).toBeUndefined();
    expect(parseDeck(res(9))).toBeUndefined();
    expect(parseDeck(res("constructor"))).toBeUndefined();
    expect(parseDeck({ success: 1 })).toBeUndefined();
    expect(parseDeck(undefined)).toBeUndefined();
  });
});

describe("Game Pass catalog", () => {
  it("keeps valid product ids once and skips the header entry", () => {
    const ids = parseGamePassIds([{ siglId: "x", title: "All PC Games" }, { id: "9NPDN9R45JX4" }, { id: "9NPDN9R45JX4" }, { id: "bad id" }, { id: 7 }, null]);
    expect(ids).toEqual(["9NPDN9R45JX4"]);
    expect(parseGamePassIds({})).toEqual([]);
  });
  it("reads product titles and ignores malformed products", () => {
    expect(parseGamePassTitles({ Products: [{ LocalizedProperties: [{ ProductTitle: " Hades " }] }, { LocalizedProperties: [] }, null, { LocalizedProperties: [{ ProductTitle: "" }] }] })).toEqual(["Hades"]);
    expect(parseGamePassTitles(null)).toEqual([]);
  });
  it("matches titles across stores, ignoring Microsoft's suffixes, case and trademarks", () => {
    const idx = gamePassIndex(["9 Kings (Game Preview)", "A Game About Digging A Hole™", "Halo - Windows 10 Edition"]);
    expect(inGamePass(idx, "9 Kings")).toBe(true);
    expect(inGamePass(idx, "a game about digging a hole")).toBe(true);
    expect(inGamePass(idx, "Halo")).toBe(true);
    expect(inGamePass(idx, "Hades")).toBe(false);
    expect(inGamePass(idx, "™")).toBe(false);
  });
  it("does not let a parenthetical in the middle of a title collapse it", () => {
    expect(catalogKey("Foo (PC) Bar")).not.toBe(catalogKey("Foo Bar"));
  });
});
