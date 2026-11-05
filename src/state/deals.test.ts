import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWishlist, fetchSteamDeals } = vi.hoisted(() => {
  const mem = new Map<string, string>();
  const localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  Object.assign(globalThis, { localStorage, window: { localStorage } });
  return { fetchWishlist: vi.fn(), fetchSteamDeals: vi.fn() };
});
vi.mock("../platform/dealsApi", () => ({ fetchWishlist, fetchSteamDeals, fetchGogDeals: vi.fn(), fetchEpicDeals: vi.fn() }));

import { historyKey } from "../domain/priceHistory";
import { useDeals } from "./deals";
import { usePriceHistory } from "./priceHistory";
import { useSecrets } from "./secrets";

const ID_A = "76561198000000001";
const ID_B = "76561198000000002";

describe("wishlist cache is tied to the SteamID", () => {
  beforeEach(() => {
    fetchWishlist.mockReset();
    useDeals.setState({ wishlist: undefined, loading: { steam: false, gog: false, epic: false, wishlist: false }, errors: {} });
  });

  it("reuses a fresh list for the same id", async () => {
    useSecrets.setState({ steamId: ID_A, steamKey: "" });
    fetchWishlist.mockResolvedValue([]);
    await useDeals.getState().refreshWishlist();
    await useDeals.getState().refreshWishlist();
    expect(fetchWishlist).toHaveBeenCalledTimes(1);
  });

  it("refetches when the SteamID changed, even inside the TTL", async () => {
    fetchWishlist.mockResolvedValue([]);
    useSecrets.setState({ steamId: ID_A, steamKey: "" });
    await useDeals.getState().refreshWishlist();
    useSecrets.setState({ steamId: ID_B, steamKey: "" });
    await useDeals.getState().refreshWishlist();
    expect(fetchWishlist).toHaveBeenCalledTimes(2);
    expect(fetchWishlist).toHaveBeenLastCalledWith(ID_B, "");
    expect(useDeals.getState().wishlist?.steamId).toBe(ID_B);
  });

  it("drops a late answer that belongs to the previous id", async () => {
    let release: (v: unknown[]) => void = () => undefined;
    fetchWishlist.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    useSecrets.setState({ steamId: ID_A, steamKey: "" });
    const pending = useDeals.getState().refreshWishlist();
    useSecrets.setState({ steamId: ID_B, steamKey: "" });
    release([{ appId: 1, title: "Old", url: "https://store.steampowered.com/app/1" }]);
    await pending;
    expect(useDeals.getState().wishlist).toBeUndefined();
  });
});

describe("price history is fed by every successful refresh", () => {
  beforeEach(() => {
    fetchSteamDeals.mockReset();
    fetchWishlist.mockReset();
    usePriceHistory.setState({ entries: {} });
    useDeals.setState({ deals: { steam: undefined, gog: undefined, epic: undefined }, wishlist: undefined, loading: { steam: false, gog: false, epic: false, wishlist: false }, errors: {} });
  });
  const deal = (finalCents: number) => ({ id: "steam:1", store: "steam", title: "Hades", url: "https://store.steampowered.com/app/1", currency: "BRL", originalCents: 7000, finalCents, discountPercent: 0 });

  it("records store deals and the priced wishlist entries", async () => {
    fetchSteamDeals.mockResolvedValue([deal(3500)]);
    await useDeals.getState().refreshDeals("steam", true);
    useSecrets.setState({ steamId: ID_A, steamKey: "" });
    fetchWishlist.mockResolvedValue([{ appId: 9, title: "Celeste", url: "https://store.steampowered.com/app/9", price: { currency: "BRL", originalCents: 5000, finalCents: 2000, discountPercent: 60 } }, { appId: 10, title: "Unreleased", url: "https://store.steampowered.com/app/10" }]);
    await useDeals.getState().refreshWishlist(true);
    expect(Object.keys(usePriceHistory.getState().entries).sort()).toEqual([historyKey("steam", "Celeste", "BRL"), historyKey("steam", "Hades", "BRL")].sort());
  });
  it("records nothing when the refresh fails", async () => {
    fetchSteamDeals.mockRejectedValue(new Error("HTTP 500"));
    await useDeals.getState().refreshDeals("steam", true);
    expect(usePriceHistory.getState().entries).toEqual({});
    expect(useDeals.getState().errors.steam).toBe("HTTP 500");
  });
});
