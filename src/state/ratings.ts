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
  errors: Record<string, string | undefined>;
  refresh: (game: Game, force?: boolean) => Promise<void>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const boundedString = (v: unknown, max: number) => typeof v === "string" && v.length <= max ? v : undefined;
const SOURCES = new Set(["steam", "rawg", "metacritic"]);
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const record = <T,>(): Record<string, T> => Object.create(null) as Record<string, T>;
const withKey = <T,>(source: Record<string, T>, key: string, value: T): Record<string, T> => {
  const next = Object.assign(record<T>(), source);
  next[key] = value;
  return next;
};

function cleanRatingEntry(raw: unknown): RatingsEntry | undefined {
  if (!isObj(raw) || typeof raw["fetchedAt"] !== "number" || !Number.isFinite(raw["fetchedAt"]) || raw["fetchedAt"] < 0 || raw["fetchedAt"] > Date.now() + CLOCK_SKEW_MS) return undefined;
  if (!Array.isArray(raw["scores"]) || !Array.isArray(raw["errors"])) return undefined;
  const scores = raw["scores"].flatMap((value): RatingsEntry["scores"] => {
    if (!isObj(value) || typeof value["source"] !== "string" || !SOURCES.has(value["source"])) return [];
    const label = boundedString(value["label"], 160);
    const score = value["score"];
    if (label === undefined || typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) return [];
    const count = value["count"];
    return [{
      source: value["source"] as RatingsEntry["scores"][number]["source"],
      label,
      score,
      count: typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : undefined,
      detail: boundedString(value["detail"], 500),
      matchedTitle: boundedString(value["matchedTitle"], 300),
    }];
  });
  const errors = raw["errors"].flatMap((error) => {
    const message = boundedString(error, 500);
    return message === undefined ? [] : [message];
  }).slice(0, 20);
  return { fetchedAt: raw["fetchedAt"], scores, errors };
}

function cleanRatingEntries(raw: unknown): Record<string, RatingsEntry> {
  if (!isObj(raw)) return {};
  const entries = record<RatingsEntry>();
  for (const [id, value] of Object.entries(raw)) {
    if (!id || id.length > 200) continue;
    const entry = cleanRatingEntry(value);
    if (entry) entries[id] = entry;
  }
  return entries;
}

export const ratingEntry = (entries: Record<string, RatingsEntry>, id: string) => Object.hasOwn(entries, id) ? entries[id] : undefined;
export const ratingIsLoading = (loading: Record<string, boolean>, id: string) => Object.hasOwn(loading, id) && loading[id] === true;

export const useRatings = create<RatingsState>()(
  persist(
    (set, get) => ({
      entries: record<RatingsEntry>(),
      loading: record<boolean>(),
      errors: record<string | undefined>(),
      refresh: async (game, force = false) => {
        if (ratingIsLoading(get().loading, game.id)) return;
        const key = useSecrets.getState().rawgKey || null;
        const cached = ratingEntry(get().entries, game.id);
        // A cache without RAWG data is not "fresh" once the user adds a key.
        const hasRawg = cached?.scores.some((s) => s.source !== "steam");
        if (!force && !isStale(cached) && (hasRawg || !key)) return;
        set((s) => ({ loading: withKey(s.loading, game.id, true) }));
        try {
          const entry = await fetchPublicRatings(game, key);
          set((s) => ({ entries: withKey(s.entries, game.id, entry), errors: withKey(s.errors, game.id, undefined) }));
        } catch {
          set((s) => ({ errors: withKey(s.errors, game.id, "Não foi possível atualizar as notas. Tente novamente.") }));
        } finally {
          set((s) => ({ loading: withKey(s.loading, game.id, false) }));
        }
      },
    }),
    {
      name: "games-gallery:ratings:v1",
      version: 1,
      partialize: ({ entries }) => ({ entries }),
      merge: (persisted, current) => {
        const state = isObj(persisted) ? persisted : {};
        return { ...current, entries: cleanRatingEntries(state["entries"]), loading: record<boolean>() };
      },
    },
  ),
);
