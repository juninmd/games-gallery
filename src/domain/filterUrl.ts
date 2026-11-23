import { EMPTY_FILTER, type GameFilter, type SortKey } from "./filter";
import { STATUS_ORDER } from "./status";

const SORT_KEYS: readonly SortKey[] = ["title", "year", "playtime", "rating"];
const MAX_TEXT = 100;
const MAX_STORES = 30;
const FLAGS = [["installed", "installedOnly"], ["owned", "ownedOnly"], ["multi", "multiStoreOnly"], ["loaned", "loanedOnly"]] as const;

const text = (v: string | null) => (v && v.length <= MAX_TEXT ? v : null);

/** Query string for a screen and its filter; only what differs from the defaults is written. */
export function filterToSearch(view: string, f: GameFilter): string {
  const p = new URLSearchParams();
  if (view !== "library") p.set("view", view);
  if (f.query.trim()) p.set("q", f.query.trim());
  if (f.providerIds.length) p.set("store", f.providerIds.join(","));
  if (f.platformId) p.set("platform", f.platformId);
  if (f.status) p.set("status", f.status);
  if (f.tag) p.set("tag", f.tag);
  for (const [key, field] of FLAGS) if (f[field]) p.set(key, "1");
  if (f.sort !== EMPTY_FILTER.sort) p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Reads a query string back; anything unknown, oversized or malformed falls back to the default. */
export function filterFromSearch<V extends string>(search: string, views: readonly V[]): { view: V | null; filter: GameFilter } {
  const p = new URLSearchParams(search);
  const view = views.find((v) => v === p.get("view")) ?? null;
  const status = STATUS_ORDER.find((s) => s === p.get("status")) ?? null;
  const sort = SORT_KEYS.find((s) => s === p.get("sort")) ?? EMPTY_FILTER.sort;
  const stores = (text(p.get("store")) ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_STORES);
  const filter: GameFilter = {
    ...EMPTY_FILTER,
    query: text(p.get("q")) ?? "",
    providerIds: [...new Set(stores)],
    platformId: text(p.get("platform")),
    status,
    tag: text(p.get("tag")),
    sort,
  };
  for (const [key, field] of FLAGS) filter[field] = p.get(key) === "1";
  return { view, filter };
}
