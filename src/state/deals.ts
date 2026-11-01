import { create } from "zustand";
import type { Deal, DealStore, WishlistEntry } from "../domain/deals";
import { fetchEpicDeals, fetchGogDeals, fetchSteamDeals, fetchWishlist } from "../platform/dealsApi";
import { useSecrets } from "./secrets";

/** Promotions move slowly; this keeps the three public endpoints from being hit on every visit. */
export const DEALS_TTL_MS = 3 * 60 * 60 * 1000;

type Slot<T> = { fetchedAt: number; items: T[] } | undefined;
type WishlistSlot = (NonNullable<Slot<WishlistEntry>> & { steamId: string }) | undefined;

interface DealsState {
  deals: Record<DealStore, Slot<Deal>>;
  wishlist: WishlistSlot;
  loading: Record<DealStore | "wishlist", boolean>;
  errors: Partial<Record<DealStore | "wishlist", string>>;
  refreshDeals: (store: DealStore, force?: boolean) => Promise<void>;
  refreshWishlist: (force?: boolean) => Promise<void>;
}

const FETCHERS: Record<DealStore, () => Promise<Deal[]>> = {
  steam: () => fetchSteamDeals(),
  gog: () => fetchGogDeals(),
  epic: () => fetchEpicDeals(),
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const fresh = (slot: Slot<unknown>, now = Date.now()) => !!slot && now - slot.fetchedAt < DEALS_TTL_MS;

export const useDeals = create<DealsState>()((set, get) => ({
  deals: { steam: undefined, gog: undefined, epic: undefined },
  wishlist: undefined,
  loading: { steam: false, gog: false, epic: false, wishlist: false },
  errors: {},
  refreshDeals: async (store, force = false) => {
    const s = get();
    if (s.loading[store] || (!force && fresh(s.deals[store]))) return;
    set({ loading: { ...s.loading, [store]: true }, errors: { ...s.errors, [store]: undefined } });
    try {
      const items = await FETCHERS[store]();
      set((x) => ({ deals: { ...x.deals, [store]: { fetchedAt: Date.now(), items } } }));
    } catch (e) {
      set((x) => ({ errors: { ...x.errors, [store]: msg(e) } }));
    } finally {
      set((x) => ({ loading: { ...x.loading, [store]: false } }));
    }
  },
  refreshWishlist: async (force = false) => {
    const s = get();
    const { steamId, steamKey } = useSecrets.getState();
    const sameAccount = s.wishlist?.steamId === steamId;
    if (s.loading.wishlist || (!force && sameAccount && fresh(s.wishlist))) return;
    set({ loading: { ...s.loading, wishlist: true }, errors: { ...s.errors, wishlist: undefined } });
    try {
      const items = await fetchWishlist(steamId, steamKey);
      // The account may have been switched while this request was in flight.
      if (useSecrets.getState().steamId === steamId) set({ wishlist: { fetchedAt: Date.now(), items, steamId } });
    } catch (e) {
      set((x) => ({ errors: { ...x.errors, wishlist: msg(e) } }));
    } finally {
      set((x) => ({ loading: { ...x.loading, wishlist: false } }));
    }
  },
}));
