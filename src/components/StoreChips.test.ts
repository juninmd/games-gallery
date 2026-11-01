import { describe, expect, it } from "vitest";
import { storeShort, storeSummary } from "./StoreChips";
import type { Game } from "../domain/types";

const g = (providerId: string): Game => ({ id: providerId, title: "T", platformId: "pc", providerId, year: 2020, genres: [], status: "backlog", owned: true, installed: false, playtimeH: 0 });

describe("storeSummary", () => {
  it("shortens long store names to the brand and keeps the order", () => {
    expect(storeShort("epic")).toBe("Epic");
    expect(storeShort("xboxpc")).toBe("Xbox");
    expect(storeShort("unknown-store")).toBe("unknown-store");
    expect(storeSummary([g("steam"), g("epic"), g("gog")]).names).toEqual(["Steam", "Epic", "GOG"]);
  });
  it("collapses a long list into +N and de-duplicates a store", () => {
    expect(storeSummary([g("steam"), g("steam"), g("epic"), g("gog"), g("ubisoft"), g("ea")], 3)).toEqual({ names: ["Steam", "Epic", "GOG"], more: 2 });
  });
});
