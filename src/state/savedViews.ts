import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameFilter } from "../domain/filter";
import { sanitizeFilter, sanitizeViews, type SavedView } from "../domain/savedViews";

interface SavedViewsState {
  views: SavedView[];
  save: (name: string, filter: GameFilter) => boolean;
  remove: (id: string) => void;
  replace: (views: SavedView[]) => void;
}

export const useSavedViews = create<SavedViewsState>()(
  persist(
    (set, get) => ({
      views: [],
      save: (name, filter) => {
        const next = sanitizeViews([...get().views, { id: crypto.randomUUID(), name, filter: sanitizeFilter(filter) }]);
        const added = next.length > get().views.length;
        if (added) set({ views: next });
        return added;
      },
      remove: (id) => set((s) => ({ views: s.views.filter((v) => v.id !== id) })),
      replace: (views) => set({ views: sanitizeViews(views) }),
    }),
    {
      name: "games-gallery:views:v1",
      version: 1,
      partialize: ({ views }) => ({ views }),
      merge: (persisted, current) => ({
        ...current,
        views: sanitizeViews(typeof persisted === "object" && persisted !== null ? (persisted as Record<string, unknown>)["views"] : undefined),
      }),
    },
  ),
);
