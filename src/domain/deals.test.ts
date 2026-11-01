import { describe, expect, it } from "vitest";
import tauriConf from "../../src-tauri/tauri.conf.json?raw";
import { DEAL_IMAGE_HOSTS, buildWishlist, formatMoney, endingSoon, liveDeals, parseEpicDeals, parseGogDeals, parseSteamSpecials, parseStoreItems, parseWishlist, sortDeals, type Deal } from "./deals";

// Shapes trimmed from the live endpoints (BR/BRL), checked against real responses.
const steamItem = (over: Record<string, unknown> = {}) => ({
  id: 1326470, name: "Sons Of The Forest", discounted: true, discount_percent: 72, original_price: 8899, final_price: 2491, currency: "BRL",
  large_capsule_image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1326470/capsule_616x353.jpg", discount_expiration: 1793642400, ...over,
});

describe("parseSteamSpecials", () => {
  it("maps the specials shelf and converts the expiry to ISO", () => {
    const [d] = parseSteamSpecials({ specials: { items: [steamItem()] } });
    expect(d).toMatchObject({ id: "steam:1326470", store: "steam", originalCents: 8899, finalCents: 2491, discountPercent: 72, steamAppId: 1326470, url: "https://store.steampowered.com/app/1326470" });
    expect(d?.endsAt).toBe(new Date(1793642400 * 1000).toISOString());
  });
  it("drops non-discounted, duplicate, malformed and foreign-image entries", () => {
    const out = parseSteamSpecials({ specials: { items: [
      steamItem({ id: 1, discount_percent: 0 }),
      steamItem({ id: 2 }), steamItem({ id: 2 }),
      steamItem({ id: 3, currency: "real" }),
      steamItem({ id: 4, name: "" }),
      steamItem({ id: 5, large_capsule_image: "https://evil.example/x.jpg", header_image: undefined }),
      null, 7,
    ] } });
    expect(out.map((d) => d.steamAppId)).toEqual([2, 5]);
    expect(out[1]?.imageUrl).toBeUndefined();
  });
  it("never throws on junk", () => {
    for (const bad of [null, "x", [], {}, { specials: null }, { specials: { items: "no" } }]) expect(parseSteamSpecials(bad)).toEqual([]);
  });
});

const gogProduct = (over: Record<string, unknown> = {}) => ({
  id: "1274966284", title: "Cyberpunk 2077: Ultimate Edition", storeLink: "https://www.gog.com/en/game/cyberpunk_2077_ultimate_edition",
  coverHorizontal: "https://images.gog-statics.com/abc_product_card_v2_mobile_slider_639.jpg",
  price: { final: "R$ 105,99", base: "R$ 265,00", discount: "-60%", finalMoney: { amount: "105.99", currency: "BRL" }, baseMoney: { amount: "265.00", currency: "BRL" } }, ...over,
});

describe("parseGogDeals", () => {
  it("reads decimal money into cents and derives the percentage", () => {
    const [d] = parseGogDeals({ products: [gogProduct()] });
    expect(d).toMatchObject({ id: "gog:1274966284", store: "gog", originalCents: 26500, finalCents: 10599, discountPercent: 60, currency: "BRL" });
  });
  it("skips undiscounted products and unsafe store links", () => {
    const out = parseGogDeals({ products: [
      gogProduct({ id: "1", price: { finalMoney: { amount: "10.00", currency: "BRL" }, baseMoney: { amount: "10.00", currency: "BRL" } } }),
      gogProduct({ id: "2", storeLink: "https://evil.example/x" }),
      gogProduct({ id: "not-a-number" }),
    ] });
    expect(out.map((d) => d.id)).toEqual(["gog:2"]);
    expect(out[0]?.url).toBe("https://www.gog.com/en/games?discounted=true");
  });
  it("never throws on junk", () => {
    for (const bad of [null, [], {}, { products: [null, 1, { price: 3 }] }]) expect(parseGogDeals(bad)).toEqual([]);
  });
});

const epicEl = (over: Record<string, unknown> = {}) => ({
  id: "e1", title: "Eternal Threads", keyImages: [{ type: "OfferImageTall", url: "https://cdn1.epicgames.com/t.jpg" }],
  offerMappings: [{ pageSlug: "eternal-threads-1a2b", pageType: "productHome" }],
  price: { totalPrice: { originalPrice: 5299, discountPrice: 1059, currencyCode: "BRL" } },
  promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-11-09T16:00:00.000Z" }] }], upcomingPromotionalOffers: [] },
  ...over,
});
const epicPayload = (elements: unknown[]) => ({ data: { Catalog: { searchStore: { elements } } } });

describe("parseEpicDeals", () => {
  it("keeps partial discounts and skips giveaways and unapplied promotions", () => {
    const out = parseEpicDeals(epicPayload([
      epicEl(),
      epicEl({ id: "free", title: "Free", price: { totalPrice: { originalPrice: 3000, discountPrice: 0, currencyCode: "BRL" } } }),
      epicEl({ id: "same", title: "Same", price: { totalPrice: { originalPrice: 3000, discountPrice: 3000, currencyCode: "BRL" } } }),
      epicEl({ id: "nopromo", title: "NoPromo", promotions: null }),
    ]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "epic:e1", discountPercent: 80, url: "https://store.epicgames.com/pt-BR/p/eternal-threads-1a2b", endsAt: "2026-11-09T16:00:00.000Z" });
  });
  it("rejects slugs that could escape the path", () => {
    const [d] = parseEpicDeals(epicPayload([epicEl({ offerMappings: [{ pageSlug: "../x?y=1", pageType: "productHome" }] })]));
    expect(d?.url).toContain("store.epicgames.com/pt-BR/browse");
  });
  it("never throws on junk", () => {
    for (const bad of [null, [], {}, { data: { Catalog: null } }, epicPayload([null, 3, {}])]) expect(parseEpicDeals(bad)).toEqual([]);
  });
});

describe("sort and expiry", () => {
  const d = (id: string, pct: number, final: number, endsAt?: string): Deal => ({ id, store: "gog", title: id, url: "https://www.gog.com/", currency: "BRL", originalCents: 1000, finalCents: final, discountPercent: pct, endsAt });
  it("orders by discount, then price", () => {
    expect(sortDeals([d("a", 50, 500), d("b", 80, 200), d("c", 50, 300)]).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
  it("drops expired promotions only", () => {
    const now = Date.parse("2026-11-01T00:00:00Z");
    expect(liveDeals([d("old", 10, 1, "2026-10-01T00:00:00Z"), d("new", 10, 1, "2026-12-01T00:00:00Z"), d("open", 10, 1)], now).map((x) => x.id)).toEqual(["new", "open"]);
  });
});

describe("wishlist", () => {
  it("treats a private/empty profile as an empty list and dedupes ids", () => {
    expect(parseWishlist({ response: {} })).toEqual([]);
    expect(parseWishlist({ response: { items: [{ appid: 10, priority: 2, date_added: 1700000000 }, { appid: 10 }, { appid: -1 }, null] } }))
      .toEqual([{ appId: 10, priority: 2, addedAt: 1700000000000 }]);
    for (const bad of [null, [], "x", { response: null }]) expect(parseWishlist(bad)).toEqual([]);
  });
  const browse = { response: { store_items: [
    { appid: 1326470, success: 1, name: "Sons Of The Forest", best_purchase_option: { final_price_in_cents: "2491", original_price_in_cents: "8899", discount_pct: 72 } },
    { appid: 1091500, success: 1, name: "Cyberpunk 2077", best_purchase_option: { final_price_in_cents: "19990" } },
    { appid: 5, success: 15 },
    { appid: 6, success: 1, name: "Unreleased" },
  ] } };
  it("reads names and prices; success!=1 rows are ignored", () => {
    const info = parseStoreItems(browse);
    expect([...info.keys()].sort()).toEqual([6, 1091500, 1326470].sort());
    expect(info.get(1326470)?.price).toMatchObject({ originalCents: 8899, finalCents: 2491, discountPercent: 72 });
    expect(info.get(1091500)?.price).toMatchObject({ originalCents: 19990, finalCents: 19990, discountPercent: 0 });
    expect(info.get(6)?.price).toBeUndefined();
  });
  it("sorts on-sale first, then by priority; unknown apps keep a placeholder title", () => {
    const entries = buildWishlist(
      [{ appId: 1091500, priority: 1 }, { appId: 1326470, priority: 5 }, { appId: 42, priority: 2 }],
      parseStoreItems(browse),
      "BRL",
    );
    expect(entries.map((e) => e.appId)).toEqual([1326470, 1091500, 42]);
    expect(entries[0]?.price?.currency).toBe("BRL");
    expect(entries[2]?.title).toBe("App 42");
  });
});

describe("formatMoney", () => {
  it("formats pt-BR and survives a bad currency code", () => {
    expect(formatMoney(2491, "BRL")).toMatch(/24,91/);
    expect(formatMoney(2491, "??")).toBe("24.91");
  });
});

describe("image hosts vs CSP", () => {
  it("every host the app may render is allowed by the Tauri CSP, so covers do not silently fall back", () => {
    const csp = (JSON.parse(tauriConf) as { app: { security: { csp: string } } }).app.security.csp;
    const img = csp.split(";").find((d) => d.trim().startsWith("img-src")) ?? "";
    const allowed = (host: string) => img.includes(`https://${host}`) || img.includes(`https://*.${host.split(".").slice(1).join(".")}`);
    for (const host of DEAL_IMAGE_HOSTS) expect(allowed(host), host).toBe(true);
  });
});

describe("endingSoon", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  const at = (iso: string) => endingSoon(iso, now);

  it("counts the time left, not calendar days, so it does not depend on the time zone", () => {
    expect(at("2026-11-01T20:00:00Z")).toBe("Acaba em menos de 24 h");
    expect(at("2026-11-02T11:59:00Z")).toBe("Acaba em menos de 24 h");
    expect(at("2026-11-02T13:00:00Z")).toBe("Acaba em 2 dias");
    expect(at("2026-11-03T11:00:00Z")).toBe("Acaba em 2 dias");
    expect(at("2026-11-04T11:00:00Z")).toBe("Acaba em 3 dias");
  });

  it("stays quiet for far-off, expired, missing and malformed dates", () => {
    expect(at("2026-11-04T13:00:00Z")).toBeUndefined();
    expect(at("2026-10-31T12:00:00Z")).toBeUndefined();
    expect(endingSoon(undefined, now)).toBeUndefined();
    expect(at("not a date")).toBeUndefined();
  });
});
