import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sanitizeTargets, targetKey, type AlertHit, type PriceTargets } from "../domain/priceAlerts";

interface PriceAlertsState {
  targets: PriceTargets;
  /** Offers under a target, from the last deals refresh of this session (not persisted). */
  hits: AlertHit[];
  setTarget: (title: string, cents: number, currency: string) => void;
  clearTarget: (title: string) => void;
  setHits: (hits: AlertHit[]) => void;
}

export const usePriceAlerts = create<PriceAlertsState>()(
  persist(
    (set) => ({
      targets: {},
      hits: [],
      setTarget: (title, cents, currency) => set((s) => ({ targets: { ...s.targets, [targetKey(title)]: { cents, currency, title } } })),
      clearTarget: (title) => set((s) => {
        const { [targetKey(title)]: _removed, ...rest } = s.targets;
        return { targets: rest };
      }),
      setHits: (hits) => set({ hits }),
    }),
    {
      name: "games-gallery:alerts:v1",
      version: 1,
      partialize: ({ targets }) => ({ targets }),
      merge: (persisted, current) => ({
        ...current,
        targets: sanitizeTargets(typeof persisted === "object" && persisted !== null ? (persisted as Record<string, unknown>)["targets"] : undefined),
      }),
    },
  ),
);
