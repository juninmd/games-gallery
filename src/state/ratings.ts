import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isStale, type RatingsEntry } from "../domain/ratings";
import type { Game } from "../domain/types";
import { fetchPublicRatings } from "../platform/ratingsApi";

/** API keys live in memory only; the Tauri phase moves them to the OS keychain. */
interface SecretsState {
  rawgKey: string;
  setRawgKey: (k: string) => void;
}

export const useSecrets = create<SecretsState>((set) => ({
  rawgKey: "",
  setRawgKey: (rawgKey) => set({ rawgKey: rawgKey.trim() }),
}));

interface RatingsState {
  entries: Record<string, RatingsEntry>;
  loading: Record<string, boolean>;
  refresh: (game: Game, force?: boolean) => Promise<void>;
}

export const useRatings = create<RatingsState>()(
  persist(
    (set, get) => ({
      entries: {},
      loading: {},
      refresh: async (game, force = false) => {
        if (get().loading[game.id]) return;
        const key = useSecrets.getState().rawgKey || null;
        const cached = get().entries[game.id];
        // A cache without RAWG data is not "fresh" once the user adds a key.
        const hasRawg = cached?.scores.some((s) => s.source !== "steam");
        if (!force && !isStale(cached) && (hasRawg || !key)) return;
        set((s) => ({ loading: { ...s.loading, [game.id]: true } }));
        const entry = await fetchPublicRatings(game, key);
        set((s) => ({ entries: { ...s.entries, [game.id]: entry }, loading: { ...s.loading, [game.id]: false } }));
      },
    }),
    { name: "games-gallery:ratings:v1", version: 1, partialize: ({ entries }) => ({ entries }) },
  ),
);
