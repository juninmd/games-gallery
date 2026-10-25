import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LINK_HOSTS, safeUrl, type Freebie, type PsPlusMonth, windowChanged } from "../domain/freebies";
import { fetchEpicFree, fetchPsPlusMonth } from "../platform/freebiesApi";

export const EPIC_TTL_MS = 6 * 60 * 60 * 1000;
/** One monthly post a month: a week of cache is plenty and keeps the crawl load negligible. */
export const PS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_CLOCK_SKEW_MS = 5 * 60 * 1000;

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
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const shortString = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined;

function cleanFreebie(raw: unknown): Freebie | undefined {
  if (!isObj(raw)) return undefined;
  const id = shortString(raw["id"], 300), title = shortString(raw["title"], 300);
  const store = raw["store"], status = raw["status"];
  const url = shortString(raw["url"], 2000);
  if (!id || !title || (store !== "epic" && store !== "psplus") || !url || !safeUrl(url, LINK_HOSTS)) return undefined;
  if ((store === "epic" && status !== "now" && status !== "upcoming") || (store === "psplus" && status !== "monthly")) return undefined;
  const validOptionalDate = (key: "startsAt" | "endsAt") => {
    const value = raw[key];
    if (value === undefined) return undefined;
    return typeof value === "string" && value.length <= 60 && Number.isFinite(Date.parse(value)) ? value : null;
  };
  const startsAt = validOptionalDate("startsAt"), endsAt = validOptionalDate("endsAt");
  if (startsAt === null || endsAt === null) return undefined;
  const imageUrl = shortString(raw["imageUrl"], 2000);
  const originalPrice = shortString(raw["originalPrice"], 100);
  const safeImage = imageUrl && safeUrl(imageUrl, new Set(["cdn1.epicgames.com"]));
  return {
    id, title, store,
    status: status as Freebie["status"],
    url,
    startsAt, endsAt,
    imageUrl: safeImage,
    originalPrice: store === "epic" ? originalPrice : undefined,
  };
}

function cleanEpicCache(raw: unknown): FreebiesState["epic"] {
  if (!isObj(raw) || typeof raw["fetchedAt"] !== "number" || !Number.isFinite(raw["fetchedAt"]) || raw["fetchedAt"] < 0 || raw["fetchedAt"] > Date.now() + CACHE_CLOCK_SKEW_MS || !Array.isArray(raw["items"])) return undefined;
  const items = raw["items"].flatMap((item): Freebie[] => {
    const freebie = cleanFreebie(item);
    return freebie?.store === "epic" ? [freebie] : [];
  });
  if (raw["items"].length > 0 && items.length === 0) return undefined;
  return { fetchedAt: raw["fetchedAt"], items };
}

function cleanPsCache(raw: unknown): FreebiesState["ps"] {
  if (!isObj(raw) || typeof raw["fetchedAt"] !== "number" || !Number.isFinite(raw["fetchedAt"]) || raw["fetchedAt"] < 0 || raw["fetchedAt"] > Date.now() + CACHE_CLOCK_SKEW_MS) return undefined;
  const month = raw["month"];
  if (month === null) return { fetchedAt: raw["fetchedAt"], month: null };
  if (!isObj(month) || !Array.isArray(month["games"])) return undefined;
  const monthName = shortString(month["month"], 30);
  const publishedAt = typeof month["publishedAt"] === "string" && month["publishedAt"].length <= 60 ? month["publishedAt"] : undefined;
  if (!monthName || publishedAt === undefined) return undefined;
  const postUrl = shortString(month["postUrl"], 2000);
  if (!postUrl || !safeUrl(postUrl, LINK_HOSTS)) return undefined;
  const games = month["games"].flatMap((game) => shortString(game, 80) ? [game] : []).slice(0, 8);
  if (month["games"].length > 0 && games.length === 0) return undefined;
  return { fetchedAt: raw["fetchedAt"], month: { month: monthName, postUrl, publishedAt, games } };
}

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
    {
      name: "games-gallery:freebies:v1",
      version: 1,
      partialize: ({ epic, ps }) => ({ epic, ps }),
      merge: (persisted, current) => {
        const state = isObj(persisted) ? persisted : {};
        return {
          ...current,
          epic: cleanEpicCache(state["epic"]),
          ps: cleanPsCache(state["ps"]),
          loading: { epic: false, ps: false },
          psPage: 0,
          errors: {},
        };
      },
    },
  ),
);
