import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dayOf, recordPrices, sanitizeHistory, type PriceHistory, type PriceObservation } from "../domain/priceHistory";

interface PriceHistoryState {
  entries: PriceHistory;
  /** Day of the last session, and of the one before it; "since your last visit" compares against the latter. */
  lastVisitDay: number;
  prevVisitDay: number;
  record: (seen: PriceObservation[], now?: number) => void;
  /** Rolls the visit days once per calendar day. */
  startVisit: (now?: number) => void;
}

const day = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 3_000_000 ? v : 0);

export const usePriceHistory = create<PriceHistoryState>()(
  persist(
    (set, get) => ({
      entries: {},
      lastVisitDay: 0,
      prevVisitDay: 0,
      record: (seen, now = Date.now()) => {
        const next = recordPrices(get().entries, seen, now);
        if (next !== get().entries) set({ entries: next });
      },
      startVisit: (now = Date.now()) => {
        const today = dayOf(now);
        const { lastVisitDay } = get();
        if (lastVisitDay >= today) return;
        set({ prevVisitDay: lastVisitDay, lastVisitDay: today });
      },
    }),
    {
      name: "games-gallery:price-history:v1",
      version: 1,
      partialize: ({ entries, lastVisitDay, prevVisitDay }) => ({ entries, lastVisitDay, prevVisitDay }),
      merge: (persisted, current) => {
        const p = typeof persisted === "object" && persisted !== null ? (persisted as Record<string, unknown>) : {};
        return { ...current, entries: sanitizeHistory(p["entries"]), lastVisitDay: day(p["lastVisitDay"]), prevVisitDay: day(p["prevVisitDay"]) };
      },
    },
  ),
);
