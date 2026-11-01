import { describe, expect, it } from "vitest";
import { dealInsights, opportunities } from "./dealInsights";
import type { Deal } from "./deals";
import type { Game } from "./types";

const deal = (store: Deal["store"], title: string, finalCents: number, over: Partial<Deal> = {}): Deal => ({
  id: `${store}:${title}`, store, title, url: "https://store.steampowered.com/app/1", currency: "BRL",
  originalCents: 10000, finalCents, discountPercent: Math.round(100 - finalCents / 100), ...over,
});
const game = (providerId: string, title: string, over: Partial<Game> = {}): Game => ({
  id: `${providerId}-${title}`, title, platformId: "pc", providerId, year: 2020, genres: [], status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});

describe("dealInsights", () => {
  it("flags the cheapest store for the same title, ignoring case, accents and symbols", () => {
    const deals = [deal("steam", "Hádes™", 5000), deal("gog", "Hades", 4000), deal("epic", "Hades", 6000), deal("steam", "Solo", 1000)];
    const m = dealInsights(deals, [], []);
    expect(m.get("gog:Hades")!.cheapest).toBe(true);
    expect(m.get("steam:Hádes™")!.cheapest).toBe(false);
    expect(m.get("steam:Hádes™")!.elsewhere).toEqual([{ store: "gog", finalCents: 4000, currency: "BRL" }, { store: "epic", finalCents: 6000, currency: "BRL" }]);
    expect(m.get("steam:Solo")!.cheapest).toBe(false); // nothing to compare against
    expect(m.get("steam:Solo")!.elsewhere).toEqual([]);
  });

  it("never compares prices across currencies", () => {
    const m = dealInsights([deal("steam", "Hades", 5000), deal("gog", "Hades", 100, { currency: "USD" })], [], []);
    expect(m.get("gog:Hades")!.cheapest).toBe(false);
    expect(m.get("steam:Hades")!.elsewhere).toEqual([]);
  });

  it("a tie is not a winner", () => {
    const m = dealInsights([deal("steam", "Hades", 4000), deal("gog", "Hades", 4000)], [], []);
    expect([...m.values()].some((x) => x.cheapest)).toBe(false);
  });

  it("lists every store that already owns the game, whichever store the deal is on", () => {
    const lib = [game("gog", "Hades"), game("epic", "Hades™"), game("steam", "Hades", { owned: false, status: "wishlist" })];
    const m = dealInsights([deal("steam", "Hades", 4000)], lib, []);
    expect(m.get("steam:Hades")!.ownedIn.sort()).toEqual(["epic", "gog"]);
    expect(m.get("steam:Hades")!.wanted).toBe(true); // also on the in-app wishlist
  });

  it("marks wishlist titles from Steam and from the library as wanted, and skips unrelated games", () => {
    const m = dealInsights([deal("gog", "Celeste", 1000), deal("gog", "Other", 1000)], [], ["celeste"]);
    expect(m.get("gog:Celeste")!.wanted).toBe(true);
    expect(m.get("gog:Other")!.wanted).toBe(false);
    expect(dealInsights([], [], []).size).toBe(0);
  });

  it("only compares live deals that have a price", () => {
    const m = dealInsights([deal("steam", "Hades", 0), deal("gog", "Hades", 4000)], [], []);
    expect(m.get("steam:Hades")!.cheapest).toBe(true); // free beats paid
  });
});

describe("opportunities", () => {
  it("keeps wanted deals you do not own, deepest discount first", () => {
    const deals = [deal("steam", "A", 7000), deal("gog", "B", 2000), deal("epic", "C", 1000), deal("steam", "D", 500)];
    const lib = [game("gog", "C")]; // C is already owned
    const m = dealInsights(deals, lib, ["a", "b", "c"]);
    expect(opportunities(deals, m).map((d) => d.title)).toEqual(["B", "A"]);
  });
});
