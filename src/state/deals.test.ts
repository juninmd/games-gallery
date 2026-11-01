import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchWishlist = vi.hoisted(() => vi.fn());
vi.mock("../platform/dealsApi", () => ({ fetchWishlist, fetchSteamDeals: vi.fn(), fetchGogDeals: vi.fn(), fetchEpicDeals: vi.fn() }));

import { useDeals } from "./deals";
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
