import { describe, expect, it } from "vitest";
import { decodeEntities, monthPt, findPsPlusMonth, freebieToGame, parseEpicFree, parseFeed, psPlusFreebies, safeUrl, LINK_HOSTS } from "./freebies";
import type { Game } from "./types";

const images = [
  { type: "OfferImageWide", url: "https://cdn1.epicgames.com/offer/wide.jpg" },
  { type: "OfferImageTall", url: "https://cdn1.epicgames.com/offer/tall.jpg" },
];
const price = { originalPrice: 3999, discountPrice: 0, currencyCode: "BRL", currencyInfo: { decimals: 2 } };
const offer = (pct: number, start: string, end: string) => ({ startDate: start, endDate: end, discountSetting: { discountType: "PERCENTAGE", discountPercentage: pct } });

// Shape trimmed from the real freeGamesPromotions payload (pt-BR/BRL).
const element = (over: Record<string, unknown>) => ({
  id: "id1", title: "Sker Ritual", keyImages: images, price: { totalPrice: price },
  offerMappings: [{ pageSlug: "sker-ritual-1a2b3c", pageType: "productHome" }], promotions: null, ...over,
});
const payload = (elements: unknown[]) => ({ data: { Catalog: { searchStore: { elements } } } });

describe("parseEpicFree", () => {
  it("keeps only 100%-off offers: discountPercentage 0 is free, 20 is just a discount", () => {
    const out = parseEpicFree(payload([
      element({ id: "free", title: "Free Now", promotions: { promotionalOffers: [{ promotionalOffers: [offer(0, "2026-10-19T15:00:00.000Z", "2026-11-02T16:00:00.000Z")] }], upcomingPromotionalOffers: [] } }),
      element({ id: "disc", title: "Discounted", promotions: { promotionalOffers: [{ promotionalOffers: [offer(20, "2026-10-19T15:00:00.000Z", "2026-11-02T16:00:00.000Z")] }], upcomingPromotionalOffers: [] } }),
      element({ id: "none", title: "No Promo", promotions: null }),
    ]));
    expect(out.map((f) => f.title)).toEqual(["Free Now"]);
    expect(out[0]).toMatchObject({ id: "epic:free", store: "epic", status: "now", endsAt: "2026-11-02T16:00:00.000Z", imageUrl: "https://cdn1.epicgames.com/offer/tall.jpg" });
  });
  it("builds the store URL from the page mapping and formats the regular price", () => {
    const [f] = parseEpicFree(payload([element({ promotions: { promotionalOffers: [{ promotionalOffers: [offer(0, "a", "b")] }], upcomingPromotionalOffers: [] } })]));
    expect(f?.url).toBe("https://store.epicgames.com/pt-BR/p/sker-ritual-1a2b3c");
    expect(f?.originalPrice).toMatch(/39,99/);
  });
  it("lists upcoming free offers after the current ones", () => {
    const out = parseEpicFree(payload([
      element({ id: "u", title: "Later", promotions: { promotionalOffers: [], upcomingPromotionalOffers: [{ promotionalOffers: [offer(0, "2026-12-01", "2026-12-08")] }] } }),
      element({ id: "n", title: "Now", promotions: { promotionalOffers: [{ promotionalOffers: [offer(0, "2026-10-19", "2026-11-02")] }], upcomingPromotionalOffers: [] } }),
    ]));
    expect(out.map((f) => `${f.title}:${f.status}`)).toEqual(["Now:now", "Later:upcoming"]);
  });
  it("falls back to the free-games page when no safe slug exists", () => {
    const [f] = parseEpicFree(payload([element({ offerMappings: [{ pageSlug: "../evil?x=1", pageType: "productHome" }], promotions: { promotionalOffers: [{ promotionalOffers: [offer(0, "a", "b")] }], upcomingPromotionalOffers: [] } })]));
    expect(f?.url).toBe("https://store.epicgames.com/pt-BR/free-games");
  });
  it("drops images from hosts that are not allow-listed", () => {
    const [f] = parseEpicFree(payload([element({ keyImages: [{ type: "OfferImageTall", url: "https://evil.example/x.jpg" }], promotions: { promotionalOffers: [{ promotionalOffers: [offer(0, "a", "b")] }], upcomingPromotionalOffers: [] } })]));
    expect(f?.imageUrl).toBeUndefined();
  });
  it("never throws on malformed payloads and skips duplicate ids", () => {
    for (const bad of [null, "x", [], {}, { data: null }, { data: { Catalog: { searchStore: { elements: "no" } } } }, payload([null, 5, {}, element({ id: "" })])]) {
      expect(parseEpicFree(bad)).toEqual([]);
    }
    const dup = element({ promotions: { promotionalOffers: [{ promotionalOffers: [offer(0, "a", "b")] }], upcomingPromotionalOffers: [] } });
    expect(parseEpicFree(payload([dup, dup]))).toHaveLength(1);
  });
});

describe("decodeEntities", () => {
  it("decodes numeric, hex, named entities and CDATA; ignores invalid code points", () => {
    expect(decodeEntities("Sniper Elite &#8211; Resistance &amp; more &#x2019;s")).toBe("Sniper Elite – Resistance & more ’s");
    expect(decodeEntities("<![CDATA[A &lt; B]]>")).toBe("A < B");
    expect(decodeEntities("x&#99999999999;y&unknown;")).toBe("xy&unknown;");
  });
});

const feed = (items: string[]) => `<rss><channel><title>PlayStation.Blog</title>${items.map((i) => `<item>${i}</item>`).join("")}</channel></rss>`;
const post = (title: string, link = "https://blog.playstation.com/2026/09/30/monthly/", date = "Wed, 30 Sep 2026 15:00:00 +0000") =>
  `<title>${title}</title><link>${link}</link><pubDate>${date}</pubDate>`;

describe("PS Plus monthly games from the blog feed", () => {
  it("parses items and finds the monthly announcement among other posts", () => {
    const items = parseFeed(feed([
      post("Marvel&#8217;s Wolverine: Photo Mode guide", "https://blog.playstation.com/a/"),
      post("PlayStation Plus Monthly Games for October: F1 25, Hunt: Showdown 1896, Earth Defense Force: World Brothers 2"),
    ]));
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe("Marvel’s Wolverine: Photo Mode guide");
    const month = findPsPlusMonth(items);
    expect(month).toMatchObject({ month: "October", games: ["F1 25", "Hunt: Showdown 1896", "Earth Defense Force: World Brothers 2"], publishedAt: "2026-09-30T15:00:00.000Z" });
  });
  it("accepts a dash separator and an 'and' before the last game", () => {
    const m = findPsPlusMonth(parseFeed(feed([post("PlayStation Plus Monthly Games for September &#8211; Sniper Elite: Resistance, MLB The Show 26 and Wobbly Life")])));
    expect(m?.games).toEqual(["Sniper Elite: Resistance", "MLB The Show 26", "Wobbly Life"]);
  });
  it("ignores Game Catalog posts and non-allow-listed links", () => {
    expect(findPsPlusMonth(parseFeed(feed([post("PlayStation Plus Game Catalog for October: Mafia, Horizon and more")])))).toBeNull();
    expect(findPsPlusMonth(parseFeed(feed([post("PlayStation Plus Monthly Games for May: A, B", "https://evil.example/x")])))).toBeNull();
    expect(findPsPlusMonth([])).toBeNull();
  });
  it("turns a month into freebies sharing the post link", () => {
    const month = findPsPlusMonth(parseFeed(feed([post("PlayStation Plus Monthly Games for October: F1 25, Hunt: Showdown 1896")])))!;
    const list = psPlusFreebies(month);
    expect(list.map((f) => f.id)).toEqual(["psplus:october:f1-25", "psplus:october:hunt-showdown-1896"]);
    expect(list.every((f) => f.status === "monthly" && f.url === month.postUrl)).toBe(true);
  });
});

describe("monthPt", () => {
  it("translates English months and leaves unknown text alone", () => {
    expect(monthPt("October")).toBe("outubro");
    expect(monthPt("MAY")).toBe("maio");
    expect(monthPt("Smarch")).toBe("Smarch");
  });
});

describe("safeUrl", () => {
  it("accepts https on allow-listed hosts only, without credentials", () => {
    expect(safeUrl("https://store.epicgames.com/pt-BR/p/x", LINK_HOSTS)).toBeDefined();
    expect(safeUrl("http://store.epicgames.com/x", LINK_HOSTS)).toBeUndefined();
    expect(safeUrl("https://store.epicgames.com.evil.example/x", LINK_HOSTS)).toBeUndefined();
    expect(safeUrl("https://user:pw@store.epicgames.com/x", LINK_HOSTS)).toBeUndefined();
    expect(safeUrl("javascript:alert(1)", LINK_HOSTS)).toBeUndefined();
    expect(safeUrl(undefined, LINK_HOSTS)).toBeUndefined();
  });
});

describe("freebieToGame", () => {
  const f = { id: "epic:1", store: "epic" as const, title: "Sker Ritual", url: "https://store.epicgames.com/pt-BR/p/x", imageUrl: "https://cdn1.epicgames.com/a.jpg", status: "now" as const };
  it("builds a wishlist or owned game for the right provider", () => {
    expect(freebieToGame(f, "wishlist", [])).toMatchObject({ providerId: "epic", platformId: "pc", status: "wishlist", owned: false, installed: false });
    expect(freebieToGame(f, "owned", [])).toMatchObject({ status: "backlog", owned: true });
    const ps = { ...f, id: "psplus:o:x", store: "psplus" as const, title: "F1 25" };
    expect(freebieToGame(ps, "owned", [], "ps4")).toMatchObject({ providerId: "psplus", platformId: "ps4" });
  });
  it("refuses a duplicate (accent/case-insensitive) and keeps ids unique", () => {
    const existing: Game[] = [{ id: "free-epic-sker-ritual", title: "SKER ritual", platformId: "pc", providerId: "epic", year: 0, genres: [], status: "backlog", owned: true, installed: false, playtimeH: 0 }];
    expect(freebieToGame(f, "owned", existing)).toBeNull();
    const other = { ...existing[0]!, providerId: "steam" };
    expect(freebieToGame(f, "owned", [other])?.id).toBe("free-epic-sker-ritual-2");
  });
});
