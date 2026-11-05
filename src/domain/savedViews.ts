import { EMPTY_FILTER, type GameFilter, type SortKey } from "./filter";
import { PLATFORM_BY_ID } from "./platforms";
import { PROVIDER_BY_ID } from "./providers";
import { STATUS_ORDER } from "./status";

export interface SavedView {
  id: string;
  name: string;
  filter: GameFilter;
}

export const MAX_VIEWS = 30;
const SORTS: SortKey[] = ["title", "year", "playtime", "rating"];
const has = (rec: object, key: string) => Object.prototype.hasOwnProperty.call(rec, key);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Untrusted -> a filter built from known fields only; anything else falls back to "no constraint". */
export function sanitizeFilter(raw: unknown): GameFilter {
  const r = isObj(raw) ? raw : {};
  const platform = typeof r["platformId"] === "string" && has(PLATFORM_BY_ID, r["platformId"]) ? r["platformId"] : null;
  const providerIds = Array.isArray(r["providerIds"]) ? [...new Set(r["providerIds"].filter((p): p is string => typeof p === "string" && has(PROVIDER_BY_ID, p)))] : [];
  return {
    query: typeof r["query"] === "string" ? r["query"].slice(0, 200) : "",
    providerIds,
    platformId: platform,
    status: STATUS_ORDER.find((s) => s === r["status"]) ?? null,
    installedOnly: r["installedOnly"] === true,
    ownedOnly: r["ownedOnly"] === true,
    multiStoreOnly: r["multiStoreOnly"] === true,
    tag: typeof r["tag"] === "string" && r["tag"].length > 0 && r["tag"].length <= 60 ? r["tag"] : null,
    sort: SORTS.find((s) => s === r["sort"]) ?? EMPTY_FILTER.sort,
  };
}

export function sanitizeViews(raw: unknown): SavedView[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedView[] = [];
  for (const v of raw) {
    if (!isObj(v) || typeof v["id"] !== "string" || typeof v["name"] !== "string") continue;
    const id = v["id"].slice(0, 60);
    const name = v["name"].replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, filter: sanitizeFilter(v["filter"]) });
    if (out.length >= MAX_VIEWS) break;
  }
  return out;
}

/** True when a filter constrains nothing (saving it would be pointless). */
export const isEmptyFilter = (f: GameFilter): boolean =>
  !f.query.trim() && !f.providerIds.length && !f.platformId && !f.status && !f.installedOnly && !f.ownedOnly && !f.multiStoreOnly && !f.tag;
