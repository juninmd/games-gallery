import { describe, expect, it } from "vitest";
import { fetchGogDeals, fetchWishlist } from "./dealsApi";

const ID = "76561198000000000";

describe("fetchWishlist", () => {
  it("batches the store lookups and orders on-sale entries first", async () => {
    const wishlist = { response: { items: Array.from({ length: 120 }, (_, i) => ({ appid: i + 1, priority: i + 1 })) } };
    const urls: string[] = [];
    const get = async (url: string) => {
      urls.push(url);
      if (url.includes("GetWishlist")) return wishlist;
      const ids = (JSON.parse(new URL(url).searchParams.get("input_json") ?? "{}") as { ids: Array<{ appid: number }> }).ids;
      return { response: { store_items: ids.map(({ appid }) => ({ appid, success: 1, name: `G${appid}`, best_purchase_option: appid === 120 ? { final_price_in_cents: "500", original_price_in_cents: "1000", discount_pct: 50 } : { final_price_in_cents: "1000" } })) } };
    };
    const entries = await fetchWishlist(ID, "", get);
    expect(entries).toHaveLength(120);
    expect(entries[0]).toMatchObject({ appId: 120, price: { discountPercent: 50, currency: "BRL" } });
    // 1 wishlist call + ceil(120/50) = 3 browse calls
    expect(urls).toHaveLength(4);
  });
  it("sends the key only when it is well-formed", async () => {
    const seen: string[] = [];
    const get = async (u: string) => { seen.push(u); return { response: {} }; };
    await fetchWishlist(ID, "not-a-key", get);
    await fetchWishlist(ID, "A".repeat(32), get);
    expect(seen[0]).not.toContain("key=");
    expect(seen[1]).toContain(`key=${"A".repeat(32)}`);
  });
  it("makes no store call for an empty (private) wishlist", async () => {
    let calls = 0;
    const out = await fetchWishlist(ID, "", async () => { calls++; return { response: {} }; });
    expect(out).toEqual([]);
    expect(calls).toBe(1);
  });
  it("rejects a malformed SteamID before any request and propagates HTTP failures", async () => {
    let calls = 0;
    await expect(fetchWishlist("123", "", async () => { calls++; return {}; })).rejects.toThrow("SteamID64");
    expect(calls).toBe(0);
    await expect(fetchWishlist(ID, "", async () => { throw new Error("HTTP 403"); })).rejects.toThrow("HTTP 403");
  });
});

describe("fetchGogDeals", () => {
  it("asks for the locale combination that returns data", async () => {
    let url = "";
    await fetchGogDeals(async (u) => { url = u; return { products: [] }; });
    expect(url).toContain("locale=en-US");
    expect(url).toContain("currencyCode=BRL");
    expect(url).toContain("discounted=eq:true");
  });
});
