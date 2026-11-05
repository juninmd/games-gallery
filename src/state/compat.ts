import { create } from "zustand";
import { persist } from "zustand/middleware";
import { catalogKey, parseProtonDb, type DeckStatus, type ProtonInfo } from "../domain/compat";
import { fetchDeck, fetchGamePassTitles, fetchProton } from "../platform/compatApi";

export const COMPAT_TTL_MS = 7 * 24 * 3600 * 1000;
export const GAME_PASS_TTL_MS = 24 * 3600 * 1000;
const MAX_ENTRIES = 500;
const MAX_KEYS = 3000;
const DECK: DeckStatus[] = ["verified", "playable", "unsupported", "unknown"];

/** `null` = asked and there is no data (do not ask again until the TTL), `undefined` = never asked. */
export interface CompatEntry {
  at: number;
  proton?: ProtonInfo | null;
  deck?: DeckStatus | null;
}
export interface GamePassCache {
  at: number;
  /** Folded catalog keys (see `catalogKey`). */
  keys: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Storage is untrusted: only numeric app ids, known tiers and statuses, bounded sizes. */
export function sanitizeCompat(raw: unknown): Record<string, CompatEntry> {
  if (!isObj(raw)) return {};
  const out: Record<string, CompatEntry> = {};
  for (const [id, v] of Object.entries(raw)) {
    if (!/^[1-9]\d{0,9}$/.test(id) || !isObj(v) || typeof v["at"] !== "number" || !Number.isFinite(v["at"])) continue;
    const proton = v["proton"] === null ? null : parseProtonDb(v["proton"]);
    const deck = v["deck"] === null ? null : DECK.find((d) => d === v["deck"]);
    out[id] = { at: v["at"], ...(proton !== undefined ? { proton } : {}), ...(deck !== undefined ? { deck } : {}) };
    if (Object.keys(out).length >= MAX_ENTRIES) break;
  }
  return out;
}

export function sanitizeGamePass(raw: unknown): GamePassCache | undefined {
  if (!isObj(raw) || typeof raw["at"] !== "number" || !Array.isArray(raw["keys"])) return undefined;
  const keys = raw["keys"].filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 160).slice(0, MAX_KEYS);
  return { at: raw["at"], keys };
}

const stale = (at: number | undefined, ttl: number, now: number) => at === undefined || now - at >= ttl || at > now;

interface CompatState {
  entries: Record<string, CompatEntry>;
  gamePass: GamePassCache | undefined;
  error?: string;
  load: (appId: number) => Promise<void>;
  loadGamePass: () => Promise<void>;
}

const inflight = new Set<string>();

export const useCompat = create<CompatState>()(
  persist(
    (set, get) => ({
      entries: {},
      gamePass: undefined,
      load: async (appId) => {
        const key = String(appId);
        if (inflight.has(key) || !stale(get().entries[key]?.at, COMPAT_TTL_MS, Date.now())) return;
        inflight.add(key);
        try {
          const [proton, deck] = await Promise.allSettled([fetchProton(appId), fetchDeck(appId)]);
          // A network failure on both leaves the cache alone so the next visit retries.
          if (proton.status === "rejected" && deck.status === "rejected") return;
          const entry: CompatEntry = { at: Date.now(), ...(proton.status === "fulfilled" ? { proton: proton.value } : {}), ...(deck.status === "fulfilled" ? { deck: deck.value } : {}) };
          set((s) => {
            const entries = { ...s.entries, [key]: entry };
            const ids = Object.keys(entries);
            if (ids.length > MAX_ENTRIES) for (const id of ids.sort((a, b) => entries[a]!.at - entries[b]!.at).slice(0, ids.length - MAX_ENTRIES)) delete entries[id];
            return { entries };
          });
        } finally {
          inflight.delete(key);
        }
      },
      loadGamePass: async () => {
        if (inflight.has("gamepass") || !stale(get().gamePass?.at, GAME_PASS_TTL_MS, Date.now())) return;
        inflight.add("gamepass");
        try {
          const keys = [...new Set((await fetchGamePassTitles()).map(catalogKey).filter(Boolean))].slice(0, MAX_KEYS);
          set({ gamePass: { at: Date.now(), keys }, error: undefined });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          inflight.delete("gamepass");
        }
      },
    }),
    {
      name: "games-gallery:compat:v1",
      version: 1,
      partialize: ({ entries, gamePass }) => ({ entries, gamePass }),
      merge: (persisted, current) => {
        const p = isObj(persisted) ? persisted : {};
        return { ...current, entries: sanitizeCompat(p["entries"]), gamePass: sanitizeGamePass(p["gamePass"]) };
      },
    },
  ),
);
