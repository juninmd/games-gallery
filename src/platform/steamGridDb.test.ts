import { describe, expect, it, vi } from "vitest";
import { findSgdbCover, firstGameId, firstGridUrl } from "./steamGridDb";

const KEY = "0123456789abcdef0123456789abcdef";
const grid = (url: string) => ({ success: true, data: [{ id: 1, url }] });
const game = { title: "Hollow Knight", providerId: "gog", storeId: undefined, steamAppId: undefined };

describe("SteamGridDB responses", () => {
  it("takes only grids served by its CDN (never an arbitrary host)", () => {
    expect(firstGridUrl(grid("https://cdn2.steamgriddb.com/grid/a.png"))).toBe("https://cdn2.steamgriddb.com/grid/a.png");
    expect(firstGridUrl(grid("https://evil.example/a.png"))).toBeUndefined();
    expect(firstGridUrl({ success: false, data: [{ url: "https://cdn2.steamgriddb.com/x.png" }] })).toBeUndefined();
    expect(firstGridUrl(null)).toBeUndefined();
  });
  it("reads a positive integer game id from a search", () => {
    expect(firstGameId({ success: true, data: [{ id: 42 }] })).toBe(42);
    expect(firstGameId({ success: true, data: [{ id: "42" }] })).toBeUndefined();
    expect(firstGameId({ success: true, data: [] })).toBeUndefined();
  });
});

describe("finding a cover", () => {
  it("uses the Steam app id first, with the key as a Bearer header", async () => {
    const get = vi.fn(async () => grid("https://cdn2.steamgriddb.com/grid/s.png"));
    const url = await findSgdbCover(KEY, { ...game, providerId: "steam", storeId: "367520" }, get);
    expect(url).toBe("https://cdn2.steamgriddb.com/grid/s.png");
    expect(get).toHaveBeenCalledWith("https://www.steamgriddb.com/api/v2/grids/steam/367520?dimensions=600x900", { Authorization: `Bearer ${KEY}` });
  });
  it("falls back to a title search, encoding the title in the path", async () => {
    const get = vi.fn(async (url: string) => (url.includes("/search/") ? { success: true, data: [{ id: 7 }] } : grid("https://cdn2.steamgriddb.com/grid/t.png")));
    const url = await findSgdbCover(KEY, { ...game, title: "Ori / Blind Forest?" }, get);
    expect(url).toBe("https://cdn2.steamgriddb.com/grid/t.png");
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      "https://www.steamgriddb.com/api/v2/search/autocomplete/Ori%20%2F%20Blind%20Forest%3F",
      "https://www.steamgriddb.com/api/v2/grids/game/7?dimensions=600x900",
    ]);
  });
  it("returns nothing when the search has no match, and refuses a malformed key before any request", async () => {
    const get = vi.fn(async () => ({ success: true, data: [] }));
    expect(await findSgdbCover(KEY, game, get)).toBeUndefined();
    await expect(findSgdbCover("bad key!", game, get)).rejects.toThrow("inválida");
    expect(get).toHaveBeenCalledTimes(1);
  });
});
