import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Freebie, type PsPlusMonth, windowChanged } from "../domain/freebies";
import { fetchEpicFree, fetchPsPlusMonth } from "../platform/freebiesApi";

export const EPIC_TTL_MS = 6 * 60 * 60 * 1000;
/** One monthly post a month: a week of cache is plenty and keeps the crawl load negligible. */
export const PS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const isFresh = (fetchedAt: number | undefined, ttl: number, now = Date.now()) => fetchedAt !== undefined && now - fetchedAt < ttl;

interface FreebiesState {
  epic?: { fetchedAt: number; items: Freebie[] };
  ps?: { fetchedAt: number; month: PsPlusMonth | null };
  loading: { epic: boolean; ps: boolean };
  psPage: number;
  errors: { epic?: string; ps?: string };
  refreshEpic: (force?: boolean) => Promise<void>;
  refreshPs: (force?: boolean) => Promise<void>;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useFreebies = create<FreebiesState>()(
  persist(
    (set, get) => ({
      loading: { epic: false, ps: false },
      psPage: 0,
      errors: {},
      refreshEpic: async (force = false) => {
        const s = get();
        const stale = !s.epic || !isFresh(s.epic.fetchedAt, EPIC_TTL_MS) || windowChanged(s.epic.items);
        if (s.loading.epic || (!force && !stale)) return;
        set({ loading: { ...s.loading, epic: true }, errors: { ...s.errors, epic: undefined } });
        try {
          const items = await fetchEpicFree();
          set({ epic: { fetchedAt: Date.now(), items } });
        } catch (e) {
          set((x) => ({ errors: { ...x.errors, epic: msg(e) } }));
        } finally {
          set((x) => ({ loading: { ...x.loading, epic: false } }));
        }
      },
      refreshPs: async (force = false) => {
        const s = get();
        if (s.loading.ps || (!force && isFresh(s.ps?.fetchedAt, PS_TTL_MS))) return;
        set({ loading: { ...s.loading, ps: true }, psPage: 0, errors: { ...s.errors, ps: undefined } });
        try {
          const month = await fetchPsPlusMonth((psPage) => set({ psPage }));
          // A miss is not cached: the post may simply not be inside the pages we walk yet.
          if (month) set({ ps: { fetchedAt: Date.now(), month } });
          else set((x) => ({ errors: { ...x.errors, ps: "Post dos jogos do mês não encontrado nas últimas páginas do blog." } }));
        } catch (e) {
          set((x) => ({ errors: { ...x.errors, ps: msg(e) } }));
        } finally {
          set((x) => ({ loading: { ...x.loading, ps: false }, psPage: 0 }));
        }
      },
    }),
    { name: "games-gallery:freebies:v1", version: 1, partialize: ({ epic, ps }) => ({ epic, ps }) },
  ),
);
